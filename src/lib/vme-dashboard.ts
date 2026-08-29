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
  aantalVoorschotten: number;
  aantalTransacties: number;
  aantalEigenaars: number;
  aantalHuurders: number;
  bankSaldo: number;
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
  const [
    { data: txData },
    { data: uittreksels },
    { data: teControlerenRows },
    { data: unitRows },
  ] = await Promise.all([
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
    db.from("unit").select("id").eq("vme_id", vmeId),
  ]);

  const unitIds = ((unitRows ?? []) as { id: string }[]).map((u) => u.id);
  const [{ count: aantalEigenaars }, { count: aantalHuurders }] = unitIds.length
    ? await Promise.all([
        db
          .from("eigenaar")
          .select("id", { count: "exact", head: true })
          .in("unit_id", unitIds),
        db
          .from("huurder")
          .select("id", { count: "exact", head: true })
          .in("unit_id", unitIds),
      ])
    : [{ count: 0 }, { count: 0 }];

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

  const bankSaldo = round2(
    rekeningen.reduce(
      (s, r) => s + (r.saldo_eind != null ? r.saldo_eind : r.mutatie),
      0,
    ),
  );

  return {
    opbrengsten,
    totaalOpbrengsten,
    uitgaven,
    totaalUitgaven,
    rekeningen,
    bankTeControleren,
    aantalVoorschotten: tx.filter((t) => t.soort === "voorschot").length,
    aantalTransacties: tx.length,
    aantalEigenaars: aantalEigenaars ?? 0,
    aantalHuurders: aantalHuurders ?? 0,
    bankSaldo,
  };
}

export interface JaarTotaal {
  label: string;
  inkomsten: number;
  uitgaven: number;
}

const INKOMST_SOORT = new Set([
  "voorschot",
  "kapitaalsoproep",
  "rente",
]);

/** Inkomsten/uitgaven per boekjaar (max 5, oud -> nieuw) voor de grafiek. */
export async function jaarlijkseTotalen(
  db: Db,
  vmeId: string,
  boekjaren: { start_datum: string; eind_datum: string }[],
): Promise<JaarTotaal[]> {
  const reeks = [...boekjaren]
    .sort((a, b) => a.start_datum.localeCompare(b.start_datum))
    .slice(-5);
  if (reeks.length === 0) return [];

  const van = reeks[0].start_datum;
  const tot = reeks[reeks.length - 1].eind_datum;
  const { data } = await db
    .from("transactie")
    .select("bedrag, soort, datum")
    .eq("vme_id", vmeId)
    .gte("datum", van)
    .lte("datum", tot);
  const rows = (data ?? []) as { bedrag: number; soort: string; datum: string }[];

  return reeks.map((bj) => {
    const inPeriode = rows.filter(
      (r) => r.datum >= bj.start_datum && r.datum <= bj.eind_datum,
    );
    const inkomsten = inPeriode
      .filter(
        (r) =>
          INKOMST_SOORT.has(r.soort) ||
          (r.soort === "afrekening" && Number(r.bedrag) > 0),
      )
      .reduce((s, r) => s + Number(r.bedrag), 0);
    const uitgaven = inPeriode
      .filter(
        (r) =>
          (r.soort === "kost" || r.soort === "terugbetaling") &&
          Number(r.bedrag) < 0,
      )
      .reduce((s, r) => s + Math.abs(Number(r.bedrag)), 0);
    const jaar = bj.eind_datum.slice(0, 4);
    return { label: jaar, inkomsten: round2(inkomsten), uitgaven: round2(uitgaven) };
  });
}
