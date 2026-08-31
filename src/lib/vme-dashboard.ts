import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { VmeRekening } from "@/lib/types";
import {
  hoortBijBoekjaar,
  boekjaarOrFilter,
  metBoekjaarFilter,
  type BoekjaarPeriode,
} from "@/lib/boekjaar-transacties";

type Db = ReturnType<typeof createAdminClient>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface Post {
  label: string;
  bedrag: number;
}

export interface RekeningCashflow {
  rekening: VmeRekening;
  inkomsten: Post[];
  totaalIn: number;
  uitgaven: Post[];
  totaalUit: number;
  saldoBegin: number | null;
  saldoEind: number | null;
  mutatie: number;
  aantal: number;
  geuploadet: boolean;
}

export interface VmeDashboard {
  zicht: RekeningCashflow;
  spaar: RekeningCashflow;
  bankTeControleren: number;
  aantalVoorschotten: number;
  aantalTransacties: number;
  aantalEigenaars: number;
  aantalHuurders: number;
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
  datum: string;
  boekjaar_id?: string | null;
}
const TX_KOL = "bedrag, soort, rekening, betaler_type, match_type, datum";

function cashflowVoorRekening(
  rek: VmeRekening,
  tx: TxRow[],
  uittreksels: {
    rekening: VmeRekening;
    saldo_begin: number | null;
    saldo_eind: number | null;
  }[],
): RekeningCashflow {
  const eigen = tx.filter((t) => t.rekening === rek);
  const som = (fn: (t: TxRow) => boolean) =>
    round2(eigen.filter(fn).reduce((s, t) => s + Number(t.bedrag), 0));

  const inkomsten: Post[] = [
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
    { label: "Kapitaalsoproepen", bedrag: som((t) => t.soort === "kapitaalsoproep") },
    { label: "Rente", bedrag: som((t) => t.soort === "rente") },
    {
      label: "Ontvangen afrekeningen",
      bedrag: som((t) => t.soort === "afrekening" && Number(t.bedrag) > 0),
    },
    {
      label:
        rek === "spaar"
          ? "Overboeking van de zichtrekening"
          : "Overboeking van de spaarrekening",
      bedrag: som(
        (t) => t.soort === "interne_overboeking" && Number(t.bedrag) > 0,
      ),
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
    {
      label:
        rek === "spaar"
          ? "Overboeking naar de zichtrekening"
          : "Overboeking naar de spaarrekening",
      bedrag: som(
        (t) => t.soort === "interne_overboeking" && Number(t.bedrag) < 0,
      ),
    },
  ].filter((p) => p.bedrag !== 0);

  const us = uittreksels.filter((u) => u.rekening === rek);
  return {
    rekening: rek,
    inkomsten,
    totaalIn: round2(inkomsten.reduce((s, p) => s + p.bedrag, 0)),
    uitgaven,
    totaalUit: round2(uitgaven.reduce((s, p) => s + p.bedrag, 0)),
    saldoBegin: us.length ? us[0].saldo_begin : null,
    saldoEind: us.length ? us[us.length - 1].saldo_eind : null,
    mutatie: round2(eigen.reduce((s, t) => s + Number(t.bedrag), 0)),
    aantal: eigen.length,
    geuploadet: us.length > 0 || eigen.length > 0,
  };
}

export async function vmeBoekjaarOverzicht(
  db: Db,
  vmeId: string,
  boekjaar: BoekjaarPeriode,
): Promise<VmeDashboard> {
  const [tx, { data: uittreksels }, { data: unitRows }] = await Promise.all([
    metBoekjaarFilter<TxRow>(
      () =>
        db
          .from("transactie")
          .select(`${TX_KOL}, boekjaar_id`)
          .eq("vme_id", vmeId)
          .or(boekjaarOrFilter(boekjaar))
          .returns<TxRow[]>(),
      () =>
        db
          .from("transactie")
          .select(TX_KOL)
          .eq("vme_id", vmeId)
          .gte("datum", boekjaar.start_datum)
          .lte("datum", boekjaar.eind_datum)
          .returns<TxRow[]>(),
      boekjaar,
    ),
    db
      .from("bankuittreksel")
      .select("rekening, periode_van, periode_tot, saldo_begin, saldo_eind")
      .eq("vme_id", vmeId)
      .lte("periode_van", boekjaar.eind_datum)
      .gte("periode_tot", boekjaar.start_datum)
      .order("periode_van", { ascending: true }),
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

  const us = (uittreksels ?? []) as {
    rekening: VmeRekening;
    saldo_begin: number | null;
    saldo_eind: number | null;
  }[];

  // Enkel wat in DIT boekjaar nog gecontroleerd moet worden.
  const bankTeControleren = tx.filter(
    (t) =>
      (t.match_type === "onbevestigd" || t.match_type == null) &&
      !GEEN_MATCH_NODIG.has(t.soort),
  ).length;

  return {
    zicht: cashflowVoorRekening("zicht", tx, us),
    spaar: cashflowVoorRekening("spaar", tx, us),
    bankTeControleren,
    aantalVoorschotten: tx.filter((t) => t.soort === "voorschot").length,
    aantalTransacties: tx.length,
    aantalEigenaars: aantalEigenaars ?? 0,
    aantalHuurders: aantalHuurders ?? 0,
  };
}

// ---------------------------------------------------------------------------

export interface FinancieelJaar {
  boekjaar_id: string;
  label: string;
  zichtIn: number;
  zichtUit: number;
  zichtSaldo: number | null;
  spaarIn: number;
  spaarUit: number;
  spaarSaldo: number | null;
}

/**
 * Bank-cashflow per rekening per boekjaar, tot `maxJaren` terug (oud -> nieuw).
 * In = alle positieve verrichtingen behalve `kost`; Uit = alle negatieve.
 * Saldo = eindsaldo van het laatste uittreksel dat in het boekjaar valt.
 */
export async function financieleEvolutie(
  db: Db,
  vmeId: string,
  boekjaren: BoekjaarPeriode[],
  maxJaren = 10,
): Promise<FinancieelJaar[]> {
  const reeks = [...boekjaren]
    .sort((a, b) => a.start_datum.localeCompare(b.start_datum))
    .slice(-maxJaren);
  if (reeks.length === 0) return [];

  type Row = {
    bedrag: number;
    soort: string;
    rekening: VmeRekening | null;
    datum: string;
    boekjaar_id?: string | null;
  };
  const metKol = await db
    .from("transactie")
    .select("bedrag, soort, rekening, datum, boekjaar_id")
    .eq("vme_id", vmeId)
    .returns<Row[]>();
  const rows: Row[] = metKol.error
    ? ((
        await db
          .from("transactie")
          .select("bedrag, soort, rekening, datum")
          .eq("vme_id", vmeId)
          .returns<Row[]>()
      ).data ?? [])
    : (metKol.data ?? []);

  const { data: uittreksels } = await db
    .from("bankuittreksel")
    .select("rekening, periode_van, periode_tot, saldo_eind")
    .eq("vme_id", vmeId)
    .order("periode_van", { ascending: true });
  const us = (uittreksels ?? []) as {
    rekening: VmeRekening;
    periode_van: string;
    periode_tot: string;
    saldo_eind: number | null;
  }[];

  return reeks.map((bj) => {
    const inPeriode = rows.filter((r) => hoortBijBoekjaar(r, bj));
    const perRekening = (rek: VmeRekening) => {
      const eigen = inPeriode.filter((r) => r.rekening === rek);
      const inn = round2(
        eigen
          .filter((r) => Number(r.bedrag) > 0 && r.soort !== "kost")
          .reduce((s, r) => s + Number(r.bedrag), 0),
      );
      const uit = round2(
        eigen
          .filter((r) => Number(r.bedrag) < 0)
          .reduce((s, r) => s + Math.abs(Number(r.bedrag)), 0),
      );
      const inBj = us.filter(
        (u) =>
          u.rekening === rek &&
          u.periode_van <= bj.eind_datum &&
          u.periode_tot >= bj.start_datum,
      );
      const saldo = inBj.length ? inBj[inBj.length - 1].saldo_eind : null;
      return { inn, uit, saldo };
    };
    const z = perRekening("zicht");
    const s = perRekening("spaar");
    return {
      boekjaar_id: bj.id,
      label: bj.eind_datum.slice(0, 4),
      zichtIn: z.inn,
      zichtUit: z.uit,
      zichtSaldo: z.saldo,
      spaarIn: s.inn,
      spaarUit: s.uit,
      spaarSaldo: s.saldo,
    };
  });
}

// ---------------------------------------------------------------------------

export interface GedeeldeKosten {
  categorieen: string[]; // gesorteerd
  jaren: { label: string; boekjaar_id: string; perCategorie: Record<string, number> }[];
}

/** Bevestigde kosten per categorie per boekjaar (tot `maxJaren`, oud -> nieuw). */
export async function gedeeldeKostenPerJaar(
  db: Db,
  vmeId: string,
  boekjaren: (BoekjaarPeriode & { id: string })[],
  maxJaren = 10,
): Promise<GedeeldeKosten> {
  const reeks = [...boekjaren]
    .sort((a, b) => a.start_datum.localeCompare(b.start_datum))
    .slice(-maxJaren);
  if (reeks.length === 0) return { categorieen: [], jaren: [] };

  const { data } = await db
    .from("kosten")
    .select("bedrag, categorie, boekjaar_id")
    .eq("vme_id", vmeId)
    .eq("status", "bevestigd")
    .in(
      "boekjaar_id",
      reeks.map((b) => b.id),
    );
  const rows = (data ?? []) as {
    bedrag: number;
    categorie: string;
    boekjaar_id: string;
  }[];

  const catSet = new Set<string>();
  const jaren = reeks.map((bj) => {
    const perCategorie: Record<string, number> = {};
    for (const r of rows.filter((x) => x.boekjaar_id === bj.id)) {
      catSet.add(r.categorie);
      perCategorie[r.categorie] =
        round2((perCategorie[r.categorie] ?? 0) + Number(r.bedrag));
    }
    return {
      label: bj.eind_datum.slice(0, 4),
      boekjaar_id: bj.id,
      perCategorie,
    };
  });

  return { categorieen: [...catSet].sort(), jaren };
}
