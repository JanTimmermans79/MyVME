import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface VoorschotRegel {
  unit_id: string;
  unit_naam: string;
  soort: "bewoner" | "reservefonds";
  wie: string;
  verwacht: number; // bedrag_per_maand * 12 (of pro rata voor deelbewoning)
  ontvangen: number;
  kapitaalsoproep: number; // enkel bij reservefonds
  afwijking: number; // ontvangen - verwacht
}

/**
 * Controle per boekjaar: heeft elke bewoner zijn voorschot gemeenschappelijke
 * kosten betaald (zichtrekening) en elke eigenaar zijn reservefonds-provisie
 * (spaarrekening, 12x)? Toont de afwijking.
 */
export async function voorschotControle(
  db: Db,
  boekjaarId: string,
): Promise<VoorschotRegel[]> {
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
  if (!bj) return [];

  const { data: units } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", bj.vme_id)
    .order("naam");
  const unitList = (units ?? []) as { id: string; naam: string }[];
  const unitIds = unitList.map((u) => u.id);
  if (unitIds.length === 0) return [];
  const unitNaam = new Map(unitList.map((u) => [u.id, u.naam]));

  const [
    { data: eigenaars },
    { data: huurders },
    { data: vse },
    { data: vsh },
    { data: tx },
  ] = await Promise.all([
    db.from("eigenaar").select("unit_id, voornaam, naam").in("unit_id", unitIds),
    db
      .from("huurder")
      .select("id, unit_id, voornaam, naam, iban, ingang_datum, uitgang_datum")
      .in("unit_id", unitIds),
    db
      .from("voorschot_eigenaar")
      .select("unit_id, bedrag_per_maand")
      .eq("boekjaar_id", boekjaarId),
    db
      .from("voorschot_huurder")
      .select("huurder_id, bedrag_per_maand")
      .eq("boekjaar_id", boekjaarId),
    db
      .from("transactie")
      .select(
        "bedrag, soort, rekening, betaler_type, gematchte_unit_id, tegenpartij_iban, datum",
      )
      .eq("vme_id", bj.vme_id)
      .gte("datum", bj.start_datum)
      .lte("datum", bj.eind_datum),
  ]);

  const txList = (tx ?? []) as {
    bedrag: number;
    soort: string;
    rekening: string | null;
    betaler_type: string | null;
    gematchte_unit_id: string | null;
    tegenpartij_iban: string | null;
    datum: string;
  }[];
  const nz = (s: string | null) =>
    s ? s.replace(/\s+/g, "").toUpperCase() : null;
  const vseMap = new Map(
    (vse ?? []).map((v: { unit_id: string; bedrag_per_maand: number }) => [
      v.unit_id,
      Number(v.bedrag_per_maand),
    ]),
  );
  const vshMap = new Map(
    (vsh ?? []).map((v: { huurder_id: string; bedrag_per_maand: number }) => [
      v.huurder_id,
      Number(v.bedrag_per_maand),
    ]),
  );

  const boekjaarDagen =
    Math.round(
      (Date.parse(bj.eind_datum) - Date.parse(bj.start_datum)) / 86_400_000,
    ) + 1;

  const regels: VoorschotRegel[] = [];

  // Reservefonds per eigenaar/unit (spaarrekening)
  const eigenaarByUnit = new Map<string, { voornaam: string | null; naam: string }>();
  for (const e of eigenaars ?? [])
    if (!eigenaarByUnit.has(e.unit_id)) eigenaarByUnit.set(e.unit_id, e);

  for (const u of unitList) {
    const perMaand = vseMap.get(u.id) ?? 0;
    const ontvangen = round2(
      txList
        .filter(
          (t) =>
            t.gematchte_unit_id === u.id &&
            t.betaler_type === "eigenaar" &&
            t.soort === "voorschot",
        )
        .reduce((s, t) => s + Number(t.bedrag), 0),
    );
    const kapitaal = round2(
      txList
        .filter(
          (t) =>
            t.gematchte_unit_id === u.id && t.soort === "kapitaalsoproep",
        )
        .reduce((s, t) => s + Number(t.bedrag), 0),
    );
    if (perMaand === 0 && ontvangen === 0 && kapitaal === 0) continue;
    const verwacht = round2(perMaand * 12);
    const e = eigenaarByUnit.get(u.id);
    regels.push({
      unit_id: u.id,
      unit_naam: unitNaam.get(u.id) ?? "—",
      soort: "reservefonds",
      wie: e ? [e.voornaam, e.naam].filter(Boolean).join(" ") : "—",
      verwacht,
      ontvangen,
      kapitaalsoproep: kapitaal,
      afwijking: round2(ontvangen - verwacht),
    });
  }

  // Bewonersvoorschot per huurder (zichtrekening)
  for (const h of (huurders ?? []) as {
    id: string;
    unit_id: string;
    voornaam: string | null;
    naam: string;
    iban: string | null;
    ingang_datum: string | null;
    uitgang_datum: string | null;
  }[]) {
    const s = h.ingang_datum ?? "0000-01-01";
    const e = h.uitgang_datum ?? "9999-12-31";
    if (!(s <= bj.eind_datum && e >= bj.start_datum)) continue;

    const pStart = s > bj.start_datum ? s : bj.start_datum;
    const pEind = e < bj.eind_datum ? e : bj.eind_datum;
    const dagen =
      Math.round((Date.parse(pEind) - Date.parse(pStart)) / 86_400_000) + 1;
    const perMaand = vshMap.get(h.id) ?? 0;
    const verwacht = round2((perMaand * 12 * dagen) / boekjaarDagen);
    const hIban = nz(h.iban);
    const ontvangen = round2(
      txList
        .filter(
          (t) =>
            t.gematchte_unit_id === h.unit_id &&
            t.betaler_type === "huurder" &&
            t.soort === "voorschot" &&
            // per-huurder toewijzen: op IBAN als bekend, anders op periode
            (hIban
              ? nz(t.tegenpartij_iban) === hIban
              : t.datum >= pStart && t.datum <= pEind),
        )
        .reduce((s2, t) => s2 + Number(t.bedrag), 0),
    );
    regels.push({
      unit_id: h.unit_id,
      unit_naam: unitNaam.get(h.unit_id) ?? "—",
      soort: "bewoner",
      wie: [h.voornaam, h.naam].filter(Boolean).join(" "),
      verwacht,
      ontvangen,
      kapitaalsoproep: 0,
      afwijking: round2(ontvangen - verwacht),
    });
  }

  return regels.sort(
    (a, b) =>
      a.unit_naam.localeCompare(b.unit_naam) ||
      a.soort.localeCompare(b.soort),
  );
}
