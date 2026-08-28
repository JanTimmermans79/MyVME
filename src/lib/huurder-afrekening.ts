import "server-only";

import { EENHEIDSPRIJS_DEFAULTS, type TellerType } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/** Categorieën die individueel via de tellers worden afgerekend (niet gedeeld). */
const METER_CATEGORIEEN = new Set([
  "mazout",
  "stookolie",
  "koud water",
  "warm water",
  "koud_water",
  "warm_water",
]);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

function dagenInclusief(van: string, tot: string): number {
  const a = Date.parse(`${van}T00:00:00Z`);
  const b = Date.parse(`${tot}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

const maxDate = (a: string, b: string) => (a > b ? a : b);
const minDate = (a: string, b: string) => (a < b ? a : b);

function normIban(s: string | null): string | null {
  return s ? s.replace(/\s+/g, "").toUpperCase() : null;
}

export interface AfrekeningLijnInput {
  soort: string;
  omschrijving: string;
  hoeveelheid: number | null;
  eenheid: string | null;
  eenheidsprijs: number | null;
  bedrag: number;
}

export interface HuurderAfrekeningResultaat {
  huurder_id: string;
  unit_id: string;
  unit_naam: string;
  huurder_naam: string;
  huurder_email: string | null;
  periode_start: string;
  periode_eind: string;
  dagen: number;
  boekjaar_dagen: number;
  actief: boolean;
  lijnen: AfrekeningLijnInput[];
  totaal_kosten: number;
  voorschot_verwacht: number;
  voorschot_ontvangen: number;
  saldo: number; // ontvangen - totaal_kosten  (negatief => bijbetalen)
  waarschuwingen: string[];
}

interface Ctx {
  boekjaar: {
    id: string;
    vme_id: string;
    start_datum: string;
    eind_datum: string;
  };
  aantalKavels: number;
  prijs: typeof EENHEIDSPRIJS_DEFAULTS;
  gedeeldPerApp: number; // totaal gedeelde huurderskosten / aantal kavels
}

async function laadContext(db: Db, boekjaarId: string): Promise<Ctx> {
  const { data: bj } = await db
    .from("boekjaar")
    .select("id, vme_id, start_datum, eind_datum")
    .eq("id", boekjaarId)
    .maybeSingle<Ctx["boekjaar"]>();
  if (!bj) throw new Error("Boekjaar niet gevonden.");

  const { data: vme } = await db
    .from("vme")
    .select("aantal_kavels")
    .eq("id", bj.vme_id)
    .maybeSingle<{ aantal_kavels: number | null }>();

  const { data: unitsCount } = await db
    .from("unit")
    .select("id")
    .eq("vme_id", bj.vme_id);
  const aantalKavels =
    vme?.aantal_kavels && vme.aantal_kavels > 0
      ? vme.aantal_kavels
      : Math.max(1, (unitsCount ?? []).length);

  const { data: ep } = await db
    .from("eenheidsprijs")
    .select("*")
    .eq("vme_id", bj.vme_id)
    .eq("boekjaar_id", boekjaarId)
    .maybeSingle<typeof EENHEIDSPRIJS_DEFAULTS>();
  const prijs = { ...EENHEIDSPRIJS_DEFAULTS, ...(ep ?? {}) };

  const { data: kosten } = await db
    .from("kosten")
    .select("bedrag, categorie")
    .eq("boekjaar_id", boekjaarId)
    .eq("status", "bevestigd")
    .eq("betaler_type", "huurder");
  const totaalGedeeld = (kosten ?? [])
    .filter(
      (k: { categorie: string }) =>
        !METER_CATEGORIEEN.has(k.categorie.toLowerCase()),
    )
    .reduce((s: number, k: { bedrag: number }) => s + Number(k.bedrag), 0);

  return {
    boekjaar: bj,
    aantalKavels,
    prijs,
    gedeeldPerApp: totaalGedeeld / aantalKavels,
  };
}

async function meterDelta(
  db: Db,
  unitId: string,
  type: TellerType,
  periodeStart: string,
  periodeEind: string,
): Promise<{ delta: number; waarschuwing: string | null }> {
  const { data: teller } = await db
    .from("teller")
    .select("id")
    .eq("unit_id", unitId)
    .eq("type", type)
    .maybeSingle<{ id: string }>();
  if (!teller)
    return { delta: 0, waarschuwing: `Geen teller "${type}" voor deze unit.` };

  const { data: standen } = await db
    .from("meterstand")
    .select("datum, waarde")
    .eq("teller_id", teller.id)
    .order("datum", { ascending: true });
  const rows = (standen ?? []) as { datum: string; waarde: number }[];
  if (rows.length < 2)
    return {
      delta: 0,
      waarschuwing: `Onvoldoende meterstanden voor "${type}".`,
    };

  const voor = [...rows].reverse().find((r) => r.datum <= periodeStart) ?? rows[0];
  const na =
    [...rows].reverse().find((r) => r.datum <= periodeEind) ??
    rows[rows.length - 1];

  if (voor === na)
    return {
      delta: 0,
      waarschuwing: `Slechts één bruikbare meterstand voor "${type}".`,
    };

  const delta = Number(na.waarde) - Number(voor.waarde);
  if (delta < 0)
    return {
      delta: 0,
      waarschuwing: `Negatief verbruik voor "${type}" (meter vervangen?).`,
    };
  return { delta: round3(delta), waarschuwing: null };
}

async function berekenVoorHuurder(
  db: Db,
  ctx: Ctx,
  huurder: {
    id: string;
    unit_id: string;
    naam: string;
    voornaam: string | null;
    email: string | null;
    iban: string | null;
    ingang_datum: string | null;
    uitgang_datum: string | null;
  },
  unitNaam: string,
): Promise<HuurderAfrekeningResultaat> {
  const bj = ctx.boekjaar;
  const periodeStart = maxDate(bj.start_datum, huurder.ingang_datum ?? bj.start_datum);
  const periodeEind = minDate(bj.eind_datum, huurder.uitgang_datum ?? bj.eind_datum);
  const dagen = dagenInclusief(periodeStart, periodeEind);
  const boekjaarDagen = dagenInclusief(bj.start_datum, bj.eind_datum);
  const naam = [huurder.voornaam, huurder.naam].filter(Boolean).join(" ");

  const base: HuurderAfrekeningResultaat = {
    huurder_id: huurder.id,
    unit_id: huurder.unit_id,
    unit_naam: unitNaam,
    huurder_naam: naam,
    huurder_email: huurder.email,
    periode_start: periodeStart,
    periode_eind: periodeEind,
    dagen,
    boekjaar_dagen: boekjaarDagen,
    actief: dagen > 0,
    lijnen: [],
    totaal_kosten: 0,
    voorschot_verwacht: 0,
    voorschot_ontvangen: 0,
    saldo: 0,
    waarschuwingen: [],
  };
  if (dagen === 0) {
    base.waarschuwingen.push("Huurder is niet actief in dit boekjaar.");
    return base;
  }

  const proRata = dagen / boekjaarDagen;
  const waarschuwingen: string[] = [];

  const [koud, warm, cv] = await Promise.all([
    meterDelta(db, huurder.unit_id, "koud_water", periodeStart, periodeEind),
    meterDelta(db, huurder.unit_id, "warm_water", periodeStart, periodeEind),
    meterDelta(db, huurder.unit_id, "cv", periodeStart, periodeEind),
  ]);
  for (const w of [koud.waarschuwing, warm.waarschuwing, cv.waarschuwing])
    if (w) waarschuwingen.push(w);

  const koudKost = round2(koud.delta * ctx.prijs.prijs_water_per_m3);
  const warmKost = round2(warm.delta * ctx.prijs.prijs_water_per_m3);
  const stookolieLiter = round3(
    cv.delta * ctx.prijs.cv_liter_per_m3 +
      warm.delta * ctx.prijs.warmwater_liter_per_m3,
  );
  const stookolieKost = round2(stookolieLiter * ctx.prijs.mazoutprijs_per_liter);
  const gedeeldAandeel = round2(ctx.gedeeldPerApp * proRata);

  const lijnen: AfrekeningLijnInput[] = [
    {
      soort: "koud_water",
      omschrijving: "Koud water",
      hoeveelheid: koud.delta,
      eenheid: "m³",
      eenheidsprijs: ctx.prijs.prijs_water_per_m3,
      bedrag: koudKost,
    },
    {
      soort: "warm_water",
      omschrijving: "Warm water",
      hoeveelheid: warm.delta,
      eenheid: "m³",
      eenheidsprijs: ctx.prijs.prijs_water_per_m3,
      bedrag: warmKost,
    },
    {
      soort: "stookolie",
      omschrijving: `Stookolie (CV ${cv.delta} m³ + warm water ${warm.delta} m³)`,
      hoeveelheid: stookolieLiter,
      eenheid: "liter",
      eenheidsprijs: ctx.prijs.mazoutprijs_per_liter,
      bedrag: stookolieKost,
    },
    {
      soort: "gedeeld",
      omschrijving: `Aandeel gedeelde kosten (${dagen}/${boekjaarDagen} dagen)`,
      hoeveelheid: round2(proRata * 100),
      eenheid: "%",
      eenheidsprijs: round2(ctx.gedeeldPerApp),
      bedrag: gedeeldAandeel,
    },
  ];

  const totaalKosten = round2(
    koudKost + warmKost + stookolieKost + gedeeldAandeel,
  );

  // voorschot verwacht
  const { data: vsh } = await db
    .from("voorschot_huurder")
    .select("bedrag_per_maand")
    .eq("huurder_id", huurder.id)
    .eq("boekjaar_id", bj.id)
    .maybeSingle<{ bedrag_per_maand: number }>();
  const verwacht = round2(
    (Number(vsh?.bedrag_per_maand ?? 0) * 12 * dagen) / boekjaarDagen,
  );

  // voorschot ontvangen: gematchte huurderbetalingen in de periode
  const { data: tx } = await db
    .from("transactie")
    .select("bedrag, tegenpartij_iban")
    .eq("gematchte_unit_id", huurder.unit_id)
    .eq("betaler_type", "huurder")
    .gte("datum", periodeStart)
    .lte("datum", periodeEind);
  const eigenIban = normIban(huurder.iban);
  const ontvangen = round2(
    (tx ?? [])
      .filter((t: { tegenpartij_iban: string | null }) => {
        if (!eigenIban) return true;
        const ti = normIban(t.tegenpartij_iban);
        return !ti || ti === eigenIban;
      })
      .reduce((s: number, t: { bedrag: number }) => s + Number(t.bedrag), 0),
  );

  const afwijking = Math.abs(ontvangen - verwacht);
  if (verwacht > 0 && afwijking > Math.max(25, 0.05 * verwacht)) {
    waarschuwingen.push(
      `Ontvangen voorschotten (€ ${ontvangen.toFixed(2)}) wijken af van verwacht (€ ${verwacht.toFixed(2)}).`,
    );
  }

  return {
    ...base,
    lijnen,
    totaal_kosten: totaalKosten,
    voorschot_verwacht: verwacht,
    voorschot_ontvangen: ontvangen,
    saldo: round2(ontvangen - totaalKosten),
    waarschuwingen,
  };
}

/** Berekent de afrekening voor elke huurder met een huurperiode in dit boekjaar. */
export async function berekenHuurderAfrekeningen(
  db: Db,
  boekjaarId: string,
): Promise<HuurderAfrekeningResultaat[]> {
  const ctx = await laadContext(db, boekjaarId);

  const { data: units } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", ctx.boekjaar.vme_id);
  const unitList = (units ?? []) as { id: string; naam: string }[];
  const unitIds = unitList.map((u) => u.id);
  const unitNaam = new Map(unitList.map((u) => [u.id, u.naam]));
  if (unitIds.length === 0) return [];

  const { data: huurders } = await db
    .from("huurder")
    .select("id, unit_id, naam, voornaam, email, iban, ingang_datum, uitgang_datum")
    .in("unit_id", unitIds);

  const relevant = (huurders ?? []).filter(
    (h: { ingang_datum: string | null; uitgang_datum: string | null }) => {
      const s = h.ingang_datum ?? "0000-01-01";
      const e = h.uitgang_datum ?? "9999-12-31";
      return s <= ctx.boekjaar.eind_datum && e >= ctx.boekjaar.start_datum;
    },
  );

  const out: HuurderAfrekeningResultaat[] = [];
  for (const h of relevant) {
    out.push(
      await berekenVoorHuurder(db, ctx, h, unitNaam.get(h.unit_id) ?? "—"),
    );
  }
  return out;
}
