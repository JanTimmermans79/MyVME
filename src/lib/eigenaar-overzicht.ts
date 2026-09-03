import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { tellerOverzicht, verbruik5Jaar } from "@/lib/verbruik";
import type { UnitTellerOverzicht, VerbruikCijfer, Verbruik5Jaar } from "@/lib/verbruik";
import type {
  Afrekening,
  AfrekeningLijn,
  Boekjaar,
  Eigenaar,
  Huurder,
  HuurderInfo,
  Teller,
  Unit,
} from "@/lib/types";

const vandaag = () => new Date().toISOString().slice(0, 10);

export interface EigenaarStand {
  teller_id: string;
  datum: string;
  waarde: number;
  aanleiding: string;
}

export interface EigenaarUnitOverzicht {
  unit: { id: string; naam: string };
  huidigeHuurder: HuurderInfo | null;
  vorigeHuurders: HuurderInfo[];
  tellers: { id: string; type: string; meternummer: string | null }[];
  standen: EigenaarStand[];
  verbruik: UnitTellerOverzicht | null;
  afrekeningen: Afrekening[];
}

export type EigenaarOverzicht =
  | { leeg: "niet-gekoppeld" | "geen-vme" }
  | {
      leeg: null;
      vme: { id: string; naam: string };
      boekjaar: Boekjaar | null;
      boekjaren: Boekjaar[];
      units: EigenaarUnitOverzicht[];
      afrekeningLijnen: AfrekeningLijn[];
      verbruik5: Verbruik5Jaar | null;
    };

function huurderInfo(h: Huurder): HuurderInfo {
  return {
    id: h.id,
    naam: [h.voornaam, h.naam].filter(Boolean).join(" ") || "Huurder",
    ingang_datum: h.ingang_datum,
    uitgang_datum: h.uitgang_datum,
  };
}

function sommeerCijfers(cijfers: VerbruikCijfer[]): VerbruikCijfer {
  const s = (f: (c: VerbruikCijfer) => number) =>
    Math.round(cijfers.reduce((t, c) => t + f(c), 0) * 1000) / 1000;
  return {
    koud: s((c) => c.koud),
    warm: s((c) => c.warm),
    cv: s((c) => c.cv),
    stookolieLiter: s((c) => c.stookolieLiter),
    koudKost: s((c) => c.koudKost),
    warmKost: s((c) => c.warmKost),
    stookolieKost: s((c) => c.stookolieKost),
    totaalKost: s((c) => c.totaalKost),
    volledig: cijfers.every((c) => c.volledig),
  };
}

/**
 * Alles wat het eigenaarsdashboard nodig heeft, beperkt tot de eigen units.
 * `metVerbruik` = ook tellers, standen, `tellerOverzicht` en de meerjarige
 * verbruiksreeks ophalen (voor `/dashboard/meterstanden`).
 */
export async function eigenaarOverzicht(
  metVerbruik: boolean,
): Promise<EigenaarOverzicht> {
  const supabase = await createClient();
  const { vme, boekjaar, boekjaren } = await getActiveContext();

  const { data: eigenaars } = await supabase
    .from("eigenaar")
    .select("*")
    .returns<Eigenaar[]>();
  if (!eigenaars || eigenaars.length === 0) return { leeg: "niet-gekoppeld" };
  if (!vme) return { leeg: "geen-vme" };

  const { data: unitRows } = await supabase
    .from("unit")
    .select("*")
    .eq("vme_id", vme.id)
    .returns<Unit[]>();
  const unitById = new Map((unitRows ?? []).map((u) => [u.id, u]));
  const mijnUnitIds = [
    ...new Set(eigenaars.map((e) => e.unit_id).filter((id) => unitById.has(id))),
  ];
  if (mijnUnitIds.length === 0) return { leeg: "niet-gekoppeld" };

  const [{ data: huurders }, { data: afrRows }] = await Promise.all([
    supabase
      .from("huurder")
      .select("*")
      .in("unit_id", mijnUnitIds)
      .order("ingang_datum", { ascending: false })
      .returns<Huurder[]>(),
    boekjaar
      ? supabase
          .from("afrekening")
          .select("*")
          .eq("boekjaar_id", boekjaar.id)
          .in("unit_id", mijnUnitIds)
          .returns<Afrekening[]>()
      : Promise.resolve({ data: [] as Afrekening[] }),
  ]);
  const afrekeningen = afrRows ?? [];

  let afrekeningLijnen: AfrekeningLijn[] = [];
  if (afrekeningen.length) {
    const { data: lj } = await supabase
      .from("afrekening_lijn")
      .select("*")
      .in(
        "afrekening_id",
        afrekeningen.map((a) => a.id),
      )
      .returns<AfrekeningLijn[]>();
    afrekeningLijnen = lj ?? [];
  }

  // Verbruik/tellers optioneel (admin-client, server-side gefilterd).
  const tellersByUnit = new Map<string, Teller[]>();
  const standenByUnit = new Map<string, EigenaarStand[]>();
  let overzichtByUnit = new Map<string, UnitTellerOverzicht>();
  let verbruik5: Verbruik5Jaar | null = null;

  if (metVerbruik) {
    const [{ data: tellerRows }, overzicht, v5] = await Promise.all([
      supabase.from("teller").select("*").in("unit_id", mijnUnitIds).returns<Teller[]>(),
      boekjaar
        ? tellerOverzicht(createAdminClient(), vme.id, boekjaar)
        : Promise.resolve([] as UnitTellerOverzicht[]),
      boekjaren.length
        ? verbruik5Jaar(createAdminClient(), vme.id, boekjaren)
        : Promise.resolve(null),
    ]);

    for (const t of tellerRows ?? []) {
      const l = tellersByUnit.get(t.unit_id) ?? [];
      l.push(t);
      tellersByUnit.set(t.unit_id, l);
    }
    overzichtByUnit = new Map(overzicht.map((o) => [o.unit_id, o]));

    const tellerIds = (tellerRows ?? []).map((t) => t.id);
    if (tellerIds.length) {
      const { data: standRows } = await supabase
        .from("meterstand")
        .select("id, teller_id, datum, waarde, aanleiding")
        .in("teller_id", tellerIds)
        .order("datum", { ascending: false });
      const tellerUnit = new Map((tellerRows ?? []).map((t) => [t.id, t.unit_id]));
      for (const s of (standRows ?? []) as EigenaarStand[]) {
        const uid = tellerUnit.get(s.teller_id);
        if (!uid) continue;
        const l = standenByUnit.get(uid) ?? [];
        l.push({
          teller_id: s.teller_id,
          datum: s.datum,
          waarde: Number(s.waarde),
          aanleiding: s.aanleiding,
        });
        standenByUnit.set(uid, l);
      }
    }

    if (v5) {
      const eigen = new Set(mijnUnitIds);
      const perUnit = Object.fromEntries(
        Object.entries(v5.perUnit).filter(([id]) => eigen.has(id)),
      );
      const blok: Record<string, VerbruikCijfer> = {};
      for (const bj of v5.boekjaren) {
        blok[bj.id] = sommeerCijfers(
          mijnUnitIds.map((id) => perUnit[id]?.[bj.id]).filter(Boolean),
        );
      }
      verbruik5 = {
        boekjaren: v5.boekjaren,
        units: v5.units.filter((u) => eigen.has(u.id)),
        perUnit,
        blok,
      };
    }
  }

  const nu = vandaag();
  const units: EigenaarUnitOverzicht[] = mijnUnitIds.map((unitId) => {
    const u = unitById.get(unitId)!;
    const unitHuurders = (huurders ?? []).filter((h) => h.unit_id === unitId);
    const huidig = unitHuurders.find(
      (h) =>
        (h.ingang_datum ?? "0000-01-01") <= nu &&
        (h.uitgang_datum ?? "9999-12-31") >= nu,
    );
    return {
      unit: { id: u.id, naam: u.naam },
      huidigeHuurder: huidig ? huurderInfo(huidig) : null,
      vorigeHuurders: unitHuurders
        .filter((h) => h.id !== huidig?.id)
        .map(huurderInfo),
      tellers: (tellersByUnit.get(unitId) ?? []).map((t) => ({
        id: t.id,
        type: t.type,
        meternummer: t.meternummer,
      })),
      standen: standenByUnit.get(unitId) ?? [],
      verbruik: overzichtByUnit.get(unitId) ?? null,
      afrekeningen: afrekeningen.filter((a) => a.unit_id === unitId),
    };
  });

  return {
    leeg: null,
    vme: { id: vme.id, naam: vme.naam },
    boekjaar,
    boekjaren,
    units,
    afrekeningLijnen,
    verbruik5,
  };
}
