import "server-only";

import type { BetalerType } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  boekjaarOrFilter,
  metBoekjaarFilter,
} from "@/lib/boekjaar-transacties";

type Db = ReturnType<typeof createAdminClient>;

export interface AfrekeningKostLijn {
  categorie: string;
  verdeling: string;
  kost_totaal: number; // totale kost van die categorie (eigenaarsdeel)
  aandeel_pct: number; // aandeel van deze unit in %
  bedrag: number; // toegerekend aan deze unit
}

export interface AfrekeningRegel {
  unit_id: string;
  unit_naam: string;
  betaler_type: BetalerType;
  verschuldigd: number;
  ontvangen: number;
  saldo: number;
  lijnen: AfrekeningKostLijn[];
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
    .select("bedrag, betaler_type, verdeling, verdeelsleutel_id, categorie")
    .eq("boekjaar_id", boekjaarId)
    .eq("status", "bevestigd");
  const kostenList = (kosten ?? []) as {
    bedrag: number;
    betaler_type: BetalerType;
    verdeling: string;
    verdeelsleutel_id: string | null;
    categorie: string;
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
    // Per categorie samengevoegd voor de detailpagina.
    const perCat = new Map<
      string,
      { verdeling: string; kost_totaal: number; bedrag: number; pctSom: number; n: number }
    >();
    for (const k of eigenaarKosten) {
      let deel: number;
      let pct: number;
      if (k.verdeling === "gelijk_eigenaars" || !k.verdeelsleutel_id) {
        deel = Number(k.bedrag) / nUnits;
        pct = 100 / nUnits;
      } else {
        const totaal = totaalPerSleutel.get(k.verdeelsleutel_id) ?? 0;
        if (totaal <= 0) {
          deel = Number(k.bedrag) / nUnits; // geen aandelen -> gelijk
          pct = 100 / nUnits;
        } else {
          const aandeel = aandeelMap.get(k.verdeelsleutel_id)?.get(unit.id) ?? 0;
          deel = (Number(k.bedrag) * aandeel) / totaal;
          pct = (aandeel / totaal) * 100;
        }
      }
      verschuldigd += deel;
      const c = perCat.get(k.categorie) ?? {
        verdeling: k.verdeling,
        kost_totaal: 0,
        bedrag: 0,
        pctSom: 0,
        n: 0,
      };
      c.kost_totaal += Number(k.bedrag);
      c.bedrag += deel;
      c.pctSom += pct;
      c.n += 1;
      perCat.set(k.categorie, c);
    }
    const lijnen: AfrekeningKostLijn[] = [...perCat]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categorie, c]) => ({
        categorie,
        verdeling: c.verdeling,
        kost_totaal: round2(c.kost_totaal),
        aandeel_pct: round2(c.pctSom / Math.max(1, c.n)),
        bedrag: round2(c.bedrag),
      }));

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
        lijnen,
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

// ---------------------------------------------------------------------------

export interface EigenaarAfrekeningRegel extends AfrekeningRegel {
  eigenaar_id: string | null;
  eigenaar_naam: string;
  eigenaar_email: string | null;
  reservefonds_ontvangen: number; // spaarrekening-provisies dit boekjaar
  kapitaalopvraging: number; // aan deze unit toegewezen kapitaalsoproepen
}

/**
 * Eigenaarafrekeningen met eigenaar-gegevens en de reservefonds-/kapitaal-stroom
 * (spaarrekening) erbij. `verschuldigd`/`ontvangen`/`saldo` = de operationele
 * eigenaarsafrekening op de zichtrekening (zoals opgeslagen). De reservefonds-
 * cijfers zijn context (aparte stroom, zie voorschotcontrole).
 */
export async function berekenEigenaarAfrekeningen(
  db: Db,
  boekjaarId: string,
): Promise<{
  regels: EigenaarAfrekeningRegel[];
  kostenZonderSleutel: number;
}> {
  const { data: bj } = await db
    .from("boekjaar")
    .select("id, vme_id, start_datum, eind_datum")
    .eq("id", boekjaarId)
    .maybeSingle<{
      id: string;
      vme_id: string;
      start_datum: string;
      eind_datum: string;
    }>();
  if (!bj) return { regels: [], kostenZonderSleutel: 0 };

  const [base, { data: units }] = await Promise.all([
    berekenAfrekening(db, boekjaarId),
    db.from("unit").select("id").eq("vme_id", bj.vme_id),
  ]);
  const unitIds = ((units ?? []) as { id: string }[]).map((u) => u.id);

  type RTx = {
    bedrag: number;
    soort: string;
    betaler_type: string | null;
    rekening: string | null;
    gematchte_unit_id: string | null;
    datum: string;
    boekjaar_id?: string | null;
  };
  const [{ data: eigenaars }, txReserve] = await Promise.all([
    unitIds.length
      ? db
          .from("eigenaar")
          .select("id, unit_id, voornaam, naam, email")
          .in("unit_id", unitIds)
      : Promise.resolve({ data: [] as unknown[] }),
    unitIds.length
      ? metBoekjaarFilter<RTx>(
          () =>
            db
              .from("transactie")
              .select(
                "bedrag, soort, betaler_type, rekening, gematchte_unit_id, datum, boekjaar_id",
              )
              .in("gematchte_unit_id", unitIds)
              .or(boekjaarOrFilter(bj))
              .returns<RTx[]>(),
          () =>
            db
              .from("transactie")
              .select(
                "bedrag, soort, betaler_type, rekening, gematchte_unit_id, datum",
              )
              .in("gematchte_unit_id", unitIds)
              .gte("datum", bj.start_datum)
              .lte("datum", bj.eind_datum)
              .returns<RTx[]>(),
          bj,
        )
      : Promise.resolve([] as RTx[]),
  ]);

  const eigByUnit = new Map<
    string,
    { id: string; voornaam: string | null; naam: string; email: string | null }
  >();
  for (const e of (eigenaars ?? []) as {
    id: string;
    unit_id: string;
    voornaam: string | null;
    naam: string;
    email: string | null;
  }[])
    if (!eigByUnit.has(e.unit_id)) eigByUnit.set(e.unit_id, e);

  const reservePerUnit = new Map<string, number>();
  const kapitaalPerUnit = new Map<string, number>();
  for (const t of txReserve) {
    if (!t.gematchte_unit_id) continue;
    if (t.soort === "voorschot" && t.betaler_type === "eigenaar" && t.rekening === "spaar")
      reservePerUnit.set(
        t.gematchte_unit_id,
        (reservePerUnit.get(t.gematchte_unit_id) ?? 0) + Number(t.bedrag),
      );
    if (t.soort === "kapitaalsoproep")
      kapitaalPerUnit.set(
        t.gematchte_unit_id,
        (kapitaalPerUnit.get(t.gematchte_unit_id) ?? 0) + Number(t.bedrag),
      );
  }

  const regels: EigenaarAfrekeningRegel[] = base.regels.map((r) => {
    const e = eigByUnit.get(r.unit_id);
    return {
      ...r,
      eigenaar_id: e?.id ?? null,
      eigenaar_naam: e
        ? [e.voornaam, e.naam].filter(Boolean).join(" ")
        : "onbekend",
      eigenaar_email: e?.email ?? null,
      reservefonds_ontvangen: round2(reservePerUnit.get(r.unit_id) ?? 0),
      kapitaalopvraging: round2(kapitaalPerUnit.get(r.unit_id) ?? 0),
    };
  });

  return { regels, kostenZonderSleutel: base.kostenZonderSleutel };
}
