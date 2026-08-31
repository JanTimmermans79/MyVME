import "server-only";

import { EENHEIDSPRIJS_DEFAULTS, type TellerType } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  boekjaarOrFilter,
  metBoekjaarFilter,
} from "@/lib/boekjaar-transacties";

type Db = ReturnType<typeof createAdminClient>;

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
  /** Huurcontract is in de loop van dit boekjaar geëindigd. */
  vertrokken_in_boekjaar: boolean;
  /** De afrekening van deze huurder is verstuurd. */
  afrekening_verzonden: boolean;
  /** Vertrokken én afrekening verstuurd → niet meer op te volgen. */
  afgehandeld: boolean;
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
  prijs: typeof EENHEIDSPRIJS_DEFAULTS;
  gedeeldPerCategorie: Map<string, number>; // som per categorie (gelijk_huurders)
  /**
   * Som van 1/(aantal bezette appartementen die dag) over de opgegeven periode.
   * Gedeeld ÷ boekjaarDagen = het effectieve aandeel van een huurder in de
   * gedeelde kosten. Leegstand wordt zo automatisch verdeeld over de aanwezige
   * huurders (regel 3).
   */
  deelfactorVoor: (start: string, eind: string) => number;
}

async function laadContext(
  db: Db,
  boekjaarId: string,
  deelfactorVoor: Ctx["deelfactorVoor"],
): Promise<Ctx> {
  const { data: bj } = await db
    .from("boekjaar")
    .select("id, vme_id, start_datum, eind_datum")
    .eq("id", boekjaarId)
    .maybeSingle<Ctx["boekjaar"]>();
  if (!bj) throw new Error("Boekjaar niet gevonden.");

  const { data: ep } = await db
    .from("eenheidsprijs")
    .select("*")
    .eq("vme_id", bj.vme_id)
    .eq("boekjaar_id", boekjaarId)
    .maybeSingle<typeof EENHEIDSPRIJS_DEFAULTS>();
  const prijs = { ...EENHEIDSPRIJS_DEFAULTS, ...(ep ?? {}) };

  const { data: kosten } = await db
    .from("kosten")
    .select("bedrag, verdeling, categorie")
    .eq("boekjaar_id", boekjaarId)
    .eq("status", "bevestigd");
  // 'Gelijk over de huurders', per categorie (elektriciteit, schoonmaak, diverse,
  // incl. negatieve posten zoals de watergroep-terugbetaling).
  const perCategorie = new Map<string, number>();
  for (const k of (kosten ?? []) as {
    bedrag: number;
    verdeling: string;
    categorie: string;
  }[]) {
    if (k.verdeling !== "gelijk_huurders") continue;
    perCategorie.set(
      k.categorie,
      (perCategorie.get(k.categorie) ?? 0) + Number(k.bedrag),
    );
  }

  return {
    boekjaar: bj,
    prijs,
    gedeeldPerCategorie: perCategorie,
    deelfactorVoor,
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
    .select("datum, waarde, aanleiding")
    .eq("teller_id", teller.id)
    .order("datum", { ascending: true });
  const alle = (standen ?? []) as {
    datum: string;
    waarde: number;
    aanleiding: string | null;
  }[];
  // Jaarafrekening rekent met afrekeningswaarden (boekjaareinde / huurderwissel),
  // niet met tussentijdse controlestanden. Enkel terugvallen op tussentijds als
  // er anders te weinig data is.
  const grens = alle.filter((r) => r.aanleiding !== "tussentijds");
  const rows = grens.length >= 2 ? grens : alle;
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
  afrekeningVerzonden: boolean,
): Promise<HuurderAfrekeningResultaat> {
  const bj = ctx.boekjaar;
  const periodeStart = maxDate(bj.start_datum, huurder.ingang_datum ?? bj.start_datum);
  const periodeEind = minDate(bj.eind_datum, huurder.uitgang_datum ?? bj.eind_datum);
  const dagen = dagenInclusief(periodeStart, periodeEind);
  const boekjaarDagen = dagenInclusief(bj.start_datum, bj.eind_datum);
  const naam = [huurder.voornaam, huurder.naam].filter(Boolean).join(" ");
  const vertrokkenInBoekjaar =
    huurder.uitgang_datum != null &&
    huurder.uitgang_datum >= bj.start_datum &&
    huurder.uitgang_datum <= bj.eind_datum;

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
    vertrokken_in_boekjaar: vertrokkenInBoekjaar,
    afrekening_verzonden: afrekeningVerzonden,
    afgehandeld: vertrokkenInBoekjaar && afrekeningVerzonden,
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
  ];

  // Gedeelde kosten: per dag gelijk verdeeld over de appartementen die die dag
  // bewoond zijn. Leegstand gaat zo automatisch naar de aanwezige huurders,
  // en een huurder die halverwege vertrekt/aankomt betaalt enkel voor zijn
  // aanwezige dagen (regels 1–3).
  const deelfactor = ctx.deelfactorVoor(periodeStart, periodeEind);
  const aandeelPct = boekjaarDagen > 0 ? (deelfactor / boekjaarDagen) * 100 : 0;
  let gedeeldAandeel = 0;
  for (const [categorie, totaal] of [...ctx.gedeeldPerCategorie].sort()) {
    const aandeel = round2((Number(totaal) / boekjaarDagen) * deelfactor);
    gedeeldAandeel += aandeel;
    lijnen.push({
      soort: "gedeeld",
      omschrijving: `${categorie} (${round2(aandeelPct)}% — ${dagen}/${boekjaarDagen} dagen aanwezig)`,
      hoeveelheid: round2(aandeelPct),
      eenheid: "%",
      eenheidsprijs: round2(Number(totaal)),
      bedrag: aandeel,
    });
  }
  gedeeldAandeel = round2(gedeeldAandeel);

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

  // voorschot ontvangen: gematchte huurder-VOORSCHOTTEN die bij dit boekjaar
  // horen (expliciet boekjaar_id of anders datum). soort='afrekening' van vorig
  // boekjaar telt dus NIET mee.
  type VsTx = {
    bedrag: number;
    tegenpartij_iban: string | null;
    datum: string;
    boekjaar_id?: string | null;
  };
  const tx = await metBoekjaarFilter<VsTx>(
    () =>
      db
        .from("transactie")
        .select("bedrag, tegenpartij_iban, datum, boekjaar_id")
        .eq("gematchte_unit_id", huurder.unit_id)
        .eq("betaler_type", "huurder")
        .eq("soort", "voorschot")
        .or(boekjaarOrFilter(bj))
        .returns<VsTx[]>(),
    () =>
      db
        .from("transactie")
        .select("bedrag, tegenpartij_iban, datum")
        .eq("gematchte_unit_id", huurder.unit_id)
        .eq("betaler_type", "huurder")
        .eq("soort", "voorschot")
        .gte("datum", bj.start_datum)
        .lte("datum", bj.eind_datum)
        .returns<VsTx[]>(),
    bj,
  );
  const eigenIban = normIban(huurder.iban);
  const ontvangen = round2(
    tx
      .filter((t) => {
        if (eigenIban) {
          const ti = normIban(t.tegenpartij_iban);
          return !ti || ti === eigenIban;
        }
        return t.datum >= periodeStart && t.datum <= periodeEind;
      })
      .reduce((s, t) => s + Number(t.bedrag), 0),
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
  const { data: bjRow } = await db
    .from("boekjaar")
    .select("vme_id, start_datum, eind_datum")
    .eq("id", boekjaarId)
    .maybeSingle<{ vme_id: string; start_datum: string; eind_datum: string }>();
  if (!bjRow) throw new Error("Boekjaar niet gevonden.");

  const { data: units } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", bjRow.vme_id);
  const unitList = (units ?? []) as { id: string; naam: string }[];
  const unitIds = unitList.map((u) => u.id);
  const unitNaam = new Map(unitList.map((u) => [u.id, u.naam]));
  if (unitIds.length === 0) return [];

  const [{ data: huurders }, { data: afrekeningen }] = await Promise.all([
    db
      .from("huurder")
      .select(
        "id, unit_id, naam, voornaam, email, iban, ingang_datum, uitgang_datum",
      )
      .in("unit_id", unitIds),
    db
      .from("afrekening")
      .select("huurder_id, mail_verzonden_op")
      .eq("boekjaar_id", boekjaarId)
      .eq("betaler_type", "huurder"),
  ]);
  const verzonden = new Set(
    (
      (afrekeningen ?? []) as {
        huurder_id: string | null;
        mail_verzonden_op: string | null;
      }[]
    )
      .filter((a) => a.huurder_id && a.mail_verzonden_op)
      .map((a) => a.huurder_id as string),
  );

  const relevant = (huurders ?? []).filter(
    (h: { ingang_datum: string | null; uitgang_datum: string | null }) => {
      const s = h.ingang_datum ?? "0000-01-01";
      const e = h.uitgang_datum ?? "9999-12-31";
      return s <= bjRow.eind_datum && e >= bjRow.start_datum;
    },
  );

  // Bezetting per dag: hoeveel appartementen zijn bewoond (regel 3 — leegstand
  // wordt verdeeld over de aanwezige huurders).
  const bjDagen = dagenInclusief(bjRow.start_datum, bjRow.eind_datum);
  const bjStartMs = Date.parse(`${bjRow.start_datum}T00:00:00Z`);
  const dagIndex = (d: string) =>
    Math.round((Date.parse(`${d}T00:00:00Z`) - bjStartMs) / 86_400_000);

  const unitBezet = new Map<string, Uint8Array>();
  for (const h of relevant as {
    unit_id: string;
    ingang_datum: string | null;
    uitgang_datum: string | null;
  }[]) {
    const s = maxDate(bjRow.start_datum, h.ingang_datum ?? bjRow.start_datum);
    const e = minDate(bjRow.eind_datum, h.uitgang_datum ?? bjRow.eind_datum);
    if (e < s) continue;
    const si = Math.max(0, dagIndex(s));
    const ei = Math.min(bjDagen - 1, dagIndex(e));
    let arr = unitBezet.get(h.unit_id);
    if (!arr) {
      arr = new Uint8Array(bjDagen);
      unitBezet.set(h.unit_id, arr);
    }
    for (let i = si; i <= ei; i++) arr[i] = 1;
  }
  const bezetting = new Uint8Array(bjDagen);
  for (const arr of unitBezet.values())
    for (let i = 0; i < bjDagen; i++) if (arr[i]) bezetting[i] += 1;

  const deelfactorVoor = (start: string, eind: string): number => {
    const si = Math.max(0, dagIndex(start));
    const ei = Math.min(bjDagen - 1, dagIndex(eind));
    let f = 0;
    for (let i = si; i <= ei; i++) if (bezetting[i] > 0) f += 1 / bezetting[i];
    return f;
  };

  const ctx = await laadContext(db, boekjaarId, deelfactorVoor);

  const out: HuurderAfrekeningResultaat[] = [];
  for (const h of relevant) {
    out.push(
      await berekenVoorHuurder(
        db,
        ctx,
        h,
        unitNaam.get(h.unit_id) ?? "—",
        verzonden.has(h.id),
      ),
    );
  }
  return out;
}
