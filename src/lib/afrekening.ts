import "server-only";

import type { BetalerType } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  boekjaarOrFilter,
  metBoekjaarFilter,
} from "@/lib/boekjaar-transacties";

type Db = ReturnType<typeof createAdminClient>;

export interface AfrekeningRegel {
  unit_id: string;
  unit_naam: string;
  betaler_type: BetalerType;
  verschuldigd: number;
  ontvangen: number;
  saldo: number;
}

export interface AfrekeningResultaat {
  regels: AfrekeningRegel[];
  kostenZonderSleutel: number;
  totaalKosten: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Berekent per unit en per betaler_type:
 *   verschuldigd = som over bevestigde kosten van (bedrag * relatief aandeel in
 *                  de verdeelsleutel van die kost), gefilterd op betaler_type
 *   ontvangen    = som van gematchte banktransacties in de boekjaarperiode
 *   saldo        = ontvangen - verschuldigd  (negatief => bijbetalen)
 */
export async function berekenAfrekening(
  db: Db,
  boekjaarId: string,
): Promise<AfrekeningResultaat> {
  const { data: boekjaar } = await db
    .from("boekjaar")
    .select("id, vme_id, start_datum, eind_datum")
    .eq("id", boekjaarId)
    .maybeSingle<{
      id: string;
      vme_id: string;
      start_datum: string;
      eind_datum: string;
    }>();
  if (!boekjaar) throw new Error("Boekjaar niet gevonden.");

  const { data: units } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", boekjaar.vme_id)
    .order("naam");
  const unitList = (units ?? []) as { id: string; naam: string }[];
  const unitIds = unitList.map((u) => u.id);

  const { data: kosten } = await db
    .from("kosten")
    .select("bedrag, betaler_type, verdeling, verdeelsleutel_id")
    .eq("boekjaar_id", boekjaarId)
    .eq("status", "bevestigd");
  const kostenList = (kosten ?? []) as {
    bedrag: number;
    betaler_type: BetalerType;
    verdeling: string;
    verdeelsleutel_id: string | null;
  }[];

  const sleutelIds = [
    ...new Set(
      kostenList
        .map((k) => k.verdeelsleutel_id)
        .filter((x): x is string => Boolean(x)),
    ),
  ];

  const { data: aandelen } = sleutelIds.length
    ? await db
        .from("verdeelsleutel_aandeel")
        .select("verdeelsleutel_id, unit_id, aandeel")
        .in("verdeelsleutel_id", sleutelIds)
    : { data: [] };
  const aandeelList = (aandelen ?? []) as {
    verdeelsleutel_id: string;
    unit_id: string;
    aandeel: number;
  }[];

  // aandeel per (sleutel, unit) + totaal per sleutel
  const aandeelMap = new Map<string, Map<string, number>>();
  const totaalPerSleutel = new Map<string, number>();
  for (const a of aandeelList) {
    if (!aandeelMap.has(a.verdeelsleutel_id))
      aandeelMap.set(a.verdeelsleutel_id, new Map());
    aandeelMap.get(a.verdeelsleutel_id)!.set(a.unit_id, Number(a.aandeel));
    totaalPerSleutel.set(
      a.verdeelsleutel_id,
      (totaalPerSleutel.get(a.verdeelsleutel_id) ?? 0) + Number(a.aandeel),
    );
  }

  type ATx = {
    bedrag: number;
    betaler_type: BetalerType | null;
    gematchte_unit_id: string | null;
    datum: string;
    soort: string;
    rekening: string | null;
    boekjaar_id?: string | null;
  };
  const ACOL = "bedrag, betaler_type, gematchte_unit_id, datum, soort, rekening";
  const txList: ATx[] = unitIds.length
    ? await metBoekjaarFilter<ATx>(
        () =>
          db
            .from("transactie")
            .select(`${ACOL}, boekjaar_id`)
            .in("gematchte_unit_id", unitIds)
            .or(boekjaarOrFilter(boekjaar))
            .returns<ATx[]>(),
        () =>
          db
            .from("transactie")
            .select(ACOL)
            .in("gematchte_unit_id", unitIds)
            .gte("datum", boekjaar.start_datum)
            .lte("datum", boekjaar.eind_datum)
            .returns<ATx[]>(),
        boekjaar,
      )
    : [];

  let kostenZonderSleutel = 0;
  let totaalKosten = 0;
  const regels: AfrekeningRegel[] = [];

  // Enkel de EIGENAAR-afrekening. Twee verdeelmethodes:
  //   per_quotiteit    -> aandeel via de verdeelsleutel van de kost
  //   gelijk_eigenaars -> bedrag gelijk over alle units
  // Huurders worden apart berekend (verbruik via tellers) in huurder-afrekening.ts.
  const bt: BetalerType = "eigenaar";
  const nUnits = unitList.length || 1;
  const eigenaarKosten = kostenList.filter((k) => k.betaler_type === bt);

  for (const unit of unitList) {
    let verschuldigd = 0;
    for (const k of eigenaarKosten) {
      if (k.verdeling === "gelijk_eigenaars" || !k.verdeelsleutel_id) {
        verschuldigd += Number(k.bedrag) / nUnits;
        continue;
      }
      const totaal = totaalPerSleutel.get(k.verdeelsleutel_id) ?? 0;
      if (totaal <= 0) {
        verschuldigd += Number(k.bedrag) / nUnits; // geen aandelen -> gelijk
        continue;
      }
      const aandeel = aandeelMap.get(k.verdeelsleutel_id)?.get(unit.id) ?? 0;
      verschuldigd += (Number(k.bedrag) * aandeel) / totaal;
    }

    // "Ontvangen" = enkel operationele eigenaarsvoorschotten op de ZICHTrekening.
    // Reservefonds-provisies (spaarrekening) en kapitaalsoproepen zijn een aparte
    // stroom (zie voorschotcontrole) en horen niet in deze afrekening.
    let ontvangen = 0;
    for (const t of txList) {
      if (t.gematchte_unit_id !== unit.id) continue;
      if (t.betaler_type !== bt) continue;
      if (t.soort !== "voorschot") continue;
      if (t.rekening === "spaar") continue;
      ontvangen += Number(t.bedrag);
    }

    verschuldigd = round2(verschuldigd);
    ontvangen = round2(ontvangen);

    if (verschuldigd !== 0 || ontvangen !== 0) {
      regels.push({
        unit_id: unit.id,
        unit_naam: unit.naam,
        betaler_type: bt,
        verschuldigd,
        ontvangen,
        saldo: round2(ontvangen - verschuldigd),
      });
    }
  }

  for (const k of eigenaarKosten) {
    totaalKosten += Number(k.bedrag);
    if (k.verdeling !== "per_quotiteit" && !k.verdeelsleutel_id)
      kostenZonderSleutel += 0; // gelijk_eigenaars is een geldige keuze, geen waarschuwing
  }

  return {
    regels,
    kostenZonderSleutel: round2(kostenZonderSleutel),
    totaalKosten: round2(totaalKosten),
  };
}
