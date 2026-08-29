import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { VmeRekening } from "@/lib/types";

type Db = ReturnType<typeof createAdminClient>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface RekeningStand {
  rekening: VmeRekening;
  geuploadet: boolean;
  saldo_begin: number | null;
  saldo_eind: number | null;
  mutatie: number;
  aantal: number;
}

export interface Post {
  label: string;
  bedrag: number;
}

export interface VmeDashboard {
  opbrengsten: Post[];
  totaalOpbrengsten: number;
  uitgaven: Post[];
  totaalUitgaven: number;
  rekeningen: RekeningStand[];
  bankTeControleren: number;
}

// Zelfde set als /admin/bank: deze soorten hoeven niet aan een unit gekoppeld.
const GEEN_MATCH_NODIG = new Set([
  "kost",
  "interne_overboeking",
  "rente",
  "afrekening",
  "kapitaalsoproep",
]);

interface TxRow {
  bedrag: number;
  soort: string;
  rekening: VmeRekening | null;
  betaler_type: string | null;
  match_type: string | null;
}

export async function vmeBoekjaarOverzicht(
  db: Db,
  vmeId: string,
  boekjaar: { start_datum: string; eind_datum: string },
): Promise<VmeDashboard> {
  const [{ data: txData }, { data: uittreksels }, { data: teControlerenRows }] =
    await Promise.all([
      db
        .from("transactie")
        .select("bedrag, soort, rekening, betaler_type, match_type")
        .eq("vme_id", vmeId)
        .gte("datum", boekjaar.start_datum)
        .lte("datum", boekjaar.eind_datum),
      db
        .from("bankuittreksel")
        .select("rekening, periode_van, periode_tot, saldo_begin, saldo_eind")
        .eq("vme_id", vmeId)
        .lte("periode_van", boekjaar.eind_datum)
        .gte("periode_tot", boekjaar.start_datum)
        .order("periode_van", { ascending: true }),
      db
        .from("transactie")
        .select("soort")
        .eq("vme_id", vmeId)
        .or("match_type.eq.onbevestigd,match_type.is.null"),
    ]);

  const tx = (txData ?? []) as TxRow[];
  const som = (fn: (t: TxRow) => boolean) =>
    round2(tx.filter(fn).reduce((s, t) => s + Number(t.bedrag), 0));

  const opbrengsten: Post[] = [
    {
      label: "Voorschotten bewoners",
      bedrag: som((t) => t.soort === "voorschot" && t.betaler_type === "huurder"),
    },
    {
      label: "Reservefonds eigenaars",
      bedrag: som(
        (t) => t.soort === "voorschot" && t.betaler_type === "eigenaar",
      ),
    },
    {
      label: "Kapitaalsoproepen",
      bedrag: som((t) => t.soort === "kapitaalsoproep"),
    },
    { label: "Rente", bedrag: som((t) => t.soort === "rente") },
    {
      label: "Ontvangen afrekeningen",
      bedrag: som((t) => t.soort === "afrekening" && Number(t.bedrag) > 0),
    },
  ].filter((p) => p.bedrag !== 0);

  const uitgaven: Post[] = [
    {
      label: "Betalingen aan leveranciers",
      bedrag: som((t) => t.soort === "kost" && Number(t.bedrag) < 0),
    },
    {
      label: "Terugbetalingen",
      bedrag: som((t) => t.soort === "terugbetaling" && Number(t.bedrag) < 0),
    },
    {
      label: "Betaalde afrekeningen",
      bedrag: som((t) => t.soort === "afrekening" && Number(t.bedrag) < 0),
    },
  ].filter((p) => p.bedrag !== 0);

  const totaalOpbrengsten = round2(
    opbrengsten.reduce((s, p) => s + p.bedrag, 0),
  );
  const totaalUitgaven = round2(uitgaven.reduce((s, p) => s + p.bedrag, 0));

  const rekeningen: RekeningStand[] = (["zicht", "spaar"] as VmeRekening[]).map(
    (rek) => {
      const eigen = tx.filter((t) => t.rekening === rek);
      const us = (uittreksels ?? []).filter((u) => u.rekening === rek);
      return {
        rekening: rek,
        geuploadet: us.length > 0 || eigen.length > 0,
        saldo_begin: us.length ? (us[0].saldo_begin as number | null) : null,
        saldo_eind: us.length
          ? (us[us.length - 1].saldo_eind as number | null)
          : null,
        mutatie: round2(eigen.reduce((s, t) => s + Number(t.bedrag), 0)),
        aantal: eigen.length,
      };
    },
  );

  const bankTeControleren = ((teControlerenRows ?? []) as { soort: string }[])
    .filter((t) => !GEEN_MATCH_NODIG.has(t.soort))
    .length;

  return {
    opbrengsten,
    totaalOpbrengsten,
    uitgaven,
    totaalUitgaven,
    rekeningen,
    bankTeControleren,
  };
}
