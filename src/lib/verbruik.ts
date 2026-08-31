import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { EENHEIDSPRIJS_DEFAULTS } from "@/lib/types";
import type { BoekjaarPeriode } from "@/lib/boekjaar-transacties";

type Db = ReturnType<typeof createAdminClient>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

type Prijs = typeof EENHEIDSPRIJS_DEFAULTS;

export interface VerbruikCijfer {
  koud: number; // m³
  warm: number; // m³
  cv: number; // m³ (CV-teller)
  stookolieLiter: number;
  koudKost: number;
  warmKost: number;
  stookolieKost: number;
  totaalKost: number;
  volledig: boolean; // alle begin- én eindstanden aanwezig
}

const LEEG: VerbruikCijfer = {
  koud: 0,
  warm: 0,
  cv: 0,
  stookolieLiter: 0,
  koudKost: 0,
  warmKost: 0,
  stookolieKost: 0,
  totaalKost: 0,
  volledig: false,
};

export interface Verbruik5Jaar {
  boekjaren: { id: string; label: string }[]; // oud -> nieuw, max 5
  units: { id: string; naam: string }[];
  perUnit: Record<string, Record<string, VerbruikCijfer>>; // unitId -> bjId -> cijfer
  blok: Record<string, VerbruikCijfer>; // bjId -> som over units
}

type Stand = { teller_id: string; datum: string; waarde: number };

/** Laatste stand strikt vóór `grens`. */
function standVoor(standen: Stand[], grens: string): number | null {
  let best: Stand | null = null;
  for (const s of standen) if (s.datum < grens) best = s;
  return best ? Number(best.waarde) : null;
}
/** Laatste stand in het venster [van, tot]. */
function standIn(standen: Stand[], van: string, tot: string): number | null {
  let best: Stand | null = null;
  for (const s of standen) if (s.datum >= van && s.datum <= tot) best = s;
  return best ? Number(best.waarde) : null;
}

function cijferVoor(
  standenPerTeller: Map<string, Stand[]>,
  tellers: { id: string; type: string }[],
  bj: BoekjaarPeriode,
  prijs: Prijs,
): VerbruikCijfer {
  const delta = (type: string): { d: number; volledig: boolean } => {
    const t = tellers.find((x) => x.type === type);
    if (!t) return { d: 0, volledig: false };
    const rows = (standenPerTeller.get(t.id) ?? []).slice().sort((a, b) =>
      a.datum.localeCompare(b.datum),
    );
    const begin = standVoor(rows, bj.start_datum);
    const eind = standIn(rows, bj.start_datum, bj.eind_datum);
    if (begin == null || eind == null) return { d: 0, volledig: false };
    const d = eind - begin;
    return { d: d > 0 ? round3(d) : 0, volledig: true };
  };

  const koud = delta("koud_water");
  const warm = delta("warm_water");
  const cv = delta("cv");

  const stookolieLiter = round3(
    cv.d * prijs.cv_liter_per_m3 + warm.d * prijs.warmwater_liter_per_m3,
  );
  const koudKost = round2(koud.d * prijs.prijs_water_per_m3);
  const warmKost = round2(warm.d * prijs.prijs_water_per_m3);
  const stookolieKost = round2(stookolieLiter * prijs.mazoutprijs_per_liter);

  return {
    koud: koud.d,
    warm: warm.d,
    cv: cv.d,
    stookolieLiter,
    koudKost,
    warmKost,
    stookolieKost,
    totaalKost: round2(koudKost + warmKost + stookolieKost),
    volledig: koud.volledig && warm.volledig && cv.volledig,
  };
}

function optel(a: VerbruikCijfer, b: VerbruikCijfer): VerbruikCijfer {
  return {
    koud: round3(a.koud + b.koud),
    warm: round3(a.warm + b.warm),
    cv: round3(a.cv + b.cv),
    stookolieLiter: round3(a.stookolieLiter + b.stookolieLiter),
    koudKost: round2(a.koudKost + b.koudKost),
    warmKost: round2(a.warmKost + b.warmKost),
    stookolieKost: round2(a.stookolieKost + b.stookolieKost),
    totaalKost: round2(a.totaalKost + b.totaalKost),
    volledig: a.volledig && b.volledig,
  };
}

// ---------------------------------------------------------------------------
// Detail voor de tellers-pagina: begin/eind/Δ per teller + tussentijdse controle
// ---------------------------------------------------------------------------

const TELLER_LABEL: Record<string, string> = {
  koud_water: "Koud water",
  warm_water: "Warm water",
  cv: "CV / stookolie",
};

export interface TellerRegel {
  type: string;
  label: string;
  beginWaarde: number | null;
  beginDatum: string | null;
  eindWaarde: number | null;
  eindDatum: string | null;
  /** Aanleiding van de eindstand — "tussentijds" = nog geen definitieve
   *  boekjaar-/afrekeningswaarde. */
  eindAanleiding: string | null;
  delta: number;
  kost: number;
  tussentijds: { id: string; datum: string; waarde: number; aanleiding: string }[];
  /** Alle standen van deze teller binnen het boekjaar (voor de invoerlijst). */
  standenDitBoekjaar: {
    id: string;
    datum: string;
    waarde: number;
    aanleiding: string;
    huurder_id: string | null;
  }[];
}

export interface UnitTellerOverzicht {
  unit_id: string;
  unit_naam: string;
  huurder: string | null;
  regels: TellerRegel[];
  totaalKost: number;
  laatsteMeting: string | null;
  geraamdeJaarkost: number | null; // enkel individueel verbruik, geëxtrapoleerd
  voorschotJaar: number;
}

export async function tellerOverzicht(
  db: Db,
  vmeId: string,
  boekjaar: BoekjaarPeriode & { id: string },
): Promise<UnitTellerOverzicht[]> {
  const { data: unitRows } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", vmeId)
    .order("naam");
  const units = (unitRows ?? []) as { id: string; naam: string }[];
  const unitIds = units.map((u) => u.id);
  if (unitIds.length === 0) return [];

  const [{ data: tellerRows }, { data: prijsRow }, { data: huurderRows }, { data: vshRows }] =
    await Promise.all([
      db.from("teller").select("id, unit_id, type").in("unit_id", unitIds),
      db
        .from("eenheidsprijs")
        .select("*")
        .eq("vme_id", vmeId)
        .eq("boekjaar_id", boekjaar.id)
        .maybeSingle<Prijs & { id: string }>(),
      db
        .from("huurder")
        .select("id, unit_id, voornaam, naam, ingang_datum, uitgang_datum")
        .in("unit_id", unitIds),
      db
        .from("voorschot_huurder")
        .select("huurder_id, bedrag_per_maand")
        .eq("boekjaar_id", boekjaar.id),
    ]);
  const prijs: Prijs = { ...EENHEIDSPRIJS_DEFAULTS, ...(prijsRow ?? {}) };
  const tellers = (tellerRows ?? []) as {
    id: string;
    unit_id: string;
    type: string;
  }[];
  const tellerIds = tellers.map((t) => t.id);

  type StandRij = Stand & {
    id: string;
    aanleiding: string;
    huurder_id: string | null;
  };
  const { data: standRows } = tellerIds.length
    ? await db
        .from("meterstand")
        .select("id, teller_id, datum, waarde, aanleiding, huurder_id")
        .in("teller_id", tellerIds)
    : { data: [] as StandRij[] };
  const standen = (standRows ?? []) as StandRij[];
  const perTeller = new Map<string, StandRij[]>();
  for (const s of standen) {
    const l = perTeller.get(s.teller_id) ?? [];
    l.push(s);
    perTeller.set(s.teller_id, l);
  }

  const vshMap = new Map(
    (vshRows ?? []).map((v: { huurder_id: string; bedrag_per_maand: number }) => [
      v.huurder_id,
      Number(v.bedrag_per_maand),
    ]),
  );
  const huurderVoorUnit = new Map<
    string,
    { id: string; naam: string; voorschot: number }
  >();
  for (const h of (huurderRows ?? []) as {
    id: string;
    unit_id: string;
    voornaam: string | null;
    naam: string;
    ingang_datum: string | null;
    uitgang_datum: string | null;
  }[]) {
    const ingang = h.ingang_datum ?? "0000-01-01";
    const uitgang = h.uitgang_datum ?? "9999-12-31";
    if (ingang <= boekjaar.eind_datum && uitgang >= boekjaar.start_datum)
      huurderVoorUnit.set(h.unit_id, {
        id: h.id,
        naam: [h.voornaam, h.naam].filter(Boolean).join(" "),
        voorschot: vshMap.get(h.id) ?? 0,
      });
  }

  const boekjaarDagen =
    Math.round(
      (Date.parse(boekjaar.eind_datum) - Date.parse(boekjaar.start_datum)) /
        86_400_000,
    ) + 1;

  return units.map((u) => {
    const ut = tellers.filter((t) => t.unit_id === u.id);
    let deltaWarm = 0;
    let deltaCv = 0;

    const regels: TellerRegel[] = (["koud_water", "warm_water", "cv"] as const).map(
      (type) => {
        const t = ut.find((x) => x.type === type);
        const rows: StandRij[] = (t ? (perTeller.get(t.id) ?? []) : [])
          .slice()
          .sort((a, b) => a.datum.localeCompare(b.datum));
        let begin: StandRij | null = null;
        let eind: StandRij | null = null;
        const tussentijds: TellerRegel["tussentijds"] = [];
        const standenDitBoekjaar: TellerRegel["standenDitBoekjaar"] = [];
        for (const r of rows) {
          if (r.datum < boekjaar.start_datum) {
            begin = r;
          } else if (r.datum <= boekjaar.eind_datum) {
            eind = r;
            standenDitBoekjaar.push({
              id: r.id,
              datum: r.datum,
              waarde: Number(r.waarde),
              aanleiding: r.aanleiding,
              huurder_id: r.huurder_id ?? null,
            });
            if (r.aanleiding === "tussentijds")
              tussentijds.push({
                id: r.id,
                datum: r.datum,
                waarde: Number(r.waarde),
                aanleiding: r.aanleiding,
              });
          }
        }
        const bW = begin ? Number(begin.waarde) : null;
        const eW = eind ? Number(eind.waarde) : null;
        const delta = bW != null && eW != null && eW >= bW ? round3(eW - bW) : 0;
        if (type === "warm_water") deltaWarm = delta;
        if (type === "cv") deltaCv = delta;

        let kost = 0;
        if (type === "koud_water") kost = round2(delta * prijs.prijs_water_per_m3);
        if (type === "warm_water") kost = round2(delta * prijs.prijs_water_per_m3);
        if (type === "cv") {
          const liter =
            deltaCv * prijs.cv_liter_per_m3 +
            deltaWarm * prijs.warmwater_liter_per_m3;
          kost = round2(liter * prijs.mazoutprijs_per_liter);
        }
        return {
          type,
          label: TELLER_LABEL[type],
          beginWaarde: bW,
          beginDatum: begin?.datum ?? null,
          eindWaarde: eW,
          eindDatum: eind?.datum ?? null,
          eindAanleiding: eind?.aanleiding ?? null,
          delta,
          kost,
          tussentijds,
          standenDitBoekjaar,
        };
      },
    );

    const totaalKost = round2(regels.reduce((s, r) => s + r.kost, 0));

    const eindDatums = regels
      .map((r) => r.eindDatum)
      .filter((d): d is string => d != null)
      .sort();
    const laatsteMeting = eindDatums.at(-1) ?? null;

    // Tussentijdse controle: extrapoleer op basis van de laatste meting.
    let geraamdeJaarkost: number | null = null;
    if (laatsteMeting != null && laatsteMeting > boekjaar.start_datum) {
      const dagen =
        Math.round(
          (Date.parse(laatsteMeting) - Date.parse(boekjaar.start_datum)) /
            86_400_000,
        ) + 1;
      if (dagen > 20 && dagen < boekjaarDagen)
        geraamdeJaarkost = round2((totaalKost * boekjaarDagen) / dagen);
    }

    const h = huurderVoorUnit.get(u.id) ?? null;
    return {
      unit_id: u.id,
      unit_naam: u.naam,
      huurder: h?.naam ?? null,
      regels,
      totaalKost,
      laatsteMeting,
      geraamdeJaarkost,
      voorschotJaar: round2((h?.voorschot ?? 0) * 12),
    };
  });
}

export async function verbruik5Jaar(
  db: Db,
  vmeId: string,
  boekjaren: (BoekjaarPeriode & { id: string })[],
  maxJaren = 10,
): Promise<Verbruik5Jaar> {
  const reeks = [...boekjaren]
    .sort((a, b) => a.start_datum.localeCompare(b.start_datum))
    .slice(-maxJaren);
  if (reeks.length === 0)
    return { boekjaren: [], units: [], perUnit: {}, blok: {} };

  const { data: unitRows } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", vmeId)
    .order("naam");
  const units = (unitRows ?? []) as { id: string; naam: string }[];
  const unitIds = units.map((u) => u.id);
  if (unitIds.length === 0)
    return {
      boekjaren: reeks.map((b) => ({ id: b.id, label: b.eind_datum.slice(0, 4) })),
      units: [],
      perUnit: {},
      blok: {},
    };

  const [{ data: tellerRows }, { data: prijsRows }] = await Promise.all([
    db.from("teller").select("id, unit_id, type").in("unit_id", unitIds),
    db
      .from("eenheidsprijs")
      .select("*")
      .eq("vme_id", vmeId)
      .in(
        "boekjaar_id",
        reeks.map((b) => b.id),
      ),
  ]);
  const tellers = (tellerRows ?? []) as {
    id: string;
    unit_id: string;
    type: string;
  }[];
  const tellerIds = tellers.map((t) => t.id);

  const { data: standRows } = tellerIds.length
    ? await db
        .from("meterstand")
        .select("teller_id, datum, waarde")
        .in("teller_id", tellerIds)
    : { data: [] as Stand[] };
  const standen = (standRows ?? []) as Stand[];
  const standenPerTeller = new Map<string, Stand[]>();
  for (const s of standen) {
    const l = standenPerTeller.get(s.teller_id) ?? [];
    l.push(s);
    standenPerTeller.set(s.teller_id, l);
  }

  const prijsPerBj = new Map<string, Prijs>();
  for (const p of (prijsRows ?? []) as (Prijs & { boekjaar_id: string })[])
    prijsPerBj.set(p.boekjaar_id, { ...EENHEIDSPRIJS_DEFAULTS, ...p });

  const tellersPerUnit = new Map<string, { id: string; type: string }[]>();
  for (const t of tellers) {
    const l = tellersPerUnit.get(t.unit_id) ?? [];
    l.push({ id: t.id, type: t.type });
    tellersPerUnit.set(t.unit_id, l);
  }

  const perUnit: Record<string, Record<string, VerbruikCijfer>> = {};
  const blok: Record<string, VerbruikCijfer> = {};

  for (const bj of reeks) {
    const prijs = prijsPerBj.get(bj.id) ?? EENHEIDSPRIJS_DEFAULTS;
    let blokCijfer = { ...LEEG, volledig: true };
    for (const u of units) {
      const c = cijferVoor(
        standenPerTeller,
        tellersPerUnit.get(u.id) ?? [],
        bj,
        prijs,
      );
      (perUnit[u.id] ??= {})[bj.id] = c;
      blokCijfer = optel(blokCijfer, c);
    }
    blok[bj.id] = blokCijfer;
  }

  return {
    boekjaren: reeks.map((b) => ({ id: b.id, label: b.eind_datum.slice(0, 4) })),
    units,
    perUnit,
    blok,
  };
}
