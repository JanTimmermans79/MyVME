import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { berekenHuurderAfrekeningen } from "@/lib/huurder-afrekening";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Herverdeling van een extra verbruikskost (bv. stadswater i.p.v. regenwater
 * door een defecte pomp) op basis van een besluit van de algemene vergadering.
 *
 * Werkt met drie kost-rijen die samen precies 0 zijn, zodat de totalen per
 * categorie (dashboards, jaarverslag) niet veranderen:
 *   − E   individueel verbruik   (haalt het extra deel uit de verbruiksfacturen)
 *   + E×p gelijk over huurders   (deel dat de AV aan de huurders toewijst)
 *   + E×(1−p) gelijk over eigenaars
 * Omdat het besluit enkel uit E en p bestaat, kan het met één handeling
 * aangepast of ongedaan gemaakt worden.
 */
export const HERVERDELING_TAG = "herverdeling_av";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Welke tellerlijnen in de huurderafrekening bij een verbruikscategorie horen. */
const METER_SOORTEN: Record<string, string[]> = {
  "koud water": ["koud_water", "warm_water"],
  mazout: ["stookolie"],
};

export interface HerverdelingInfo {
  categorie: string;
  /** Verbruiksfacturen van de categorie (individueel verbruik, zonder herverdeling). */
  facturen: number;
  /** Wat de huurders via hun tellers aangerekend krijgen (null = onbekend). */
  viaTellers: number | null;
  /** facturen − viaTellers */
  verschil: number | null;
  /** hetzelfde verschil in het vorige boekjaar (de "normale" afwijking) */
  vorigJaarVerschil: number | null;
  /** Voorstel voor het extra bedrag: verschil − normale afwijking. */
  voorstel: number | null;
  aantalEigenaars: number;
  actief: {
    bedrag: number;
    huurders: number;
    eigenaars: number;
    pctHuurders: number;
    toelichting: string | null;
  } | null;
}

async function viaTellers(
  db: Db,
  boekjaarId: string,
  categorie: string,
): Promise<number | null> {
  const soorten = METER_SOORTEN[categorie];
  if (!soorten) return null;
  const res = await berekenHuurderAfrekeningen(db, boekjaarId);
  return round2(
    res
      .filter((r) => r.actief)
      .flatMap((r) => r.lijnen)
      .filter((l) => soorten.includes(l.soort))
      .reduce((s, l) => s + l.bedrag, 0),
  );
}

async function facturen(
  db: Db,
  boekjaarId: string,
  categorie: string,
): Promise<number> {
  const { data } = await db
    .from("kosten")
    .select("bedrag, omschrijving_extra")
    .eq("boekjaar_id", boekjaarId)
    .eq("categorie", categorie)
    .eq("verdeling", "individueel_verbruik")
    .eq("status", "bevestigd");
  return round2(
    ((data ?? []) as { bedrag: number; omschrijving_extra: string | null }[])
      .filter((k) => k.omschrijving_extra !== HERVERDELING_TAG)
      .reduce((s, k) => s + Number(k.bedrag), 0),
  );
}

/** Verbruikscategorieën waarvoor een herverdeling zinvol is in dit boekjaar. */
export const HERVERDEELBARE_CATEGORIEEN = Object.keys(METER_SOORTEN);

export async function laadHerverdelingInfo(
  db: Db,
  vmeId: string,
  boekjaarId: string,
  categorie: string,
): Promise<HerverdelingInfo> {
  const { data: bj } = await db
    .from("boekjaar")
    .select("id, start_datum")
    .eq("id", boekjaarId)
    .maybeSingle<{ id: string; start_datum: string }>();

  const { data: vorig } = bj
    ? await db
        .from("boekjaar")
        .select("id")
        .eq("vme_id", vmeId)
        .lt("start_datum", bj.start_datum)
        .order("start_datum", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>()
    : { data: null };

  const [fact, tellers, { count: aantalUnits }, { data: tagged }] =
    await Promise.all([
      facturen(db, boekjaarId, categorie),
      viaTellers(db, boekjaarId, categorie),
      db
        .from("unit")
        .select("id", { count: "exact", head: true })
        .eq("vme_id", vmeId),
      db
        .from("kosten")
        .select("bedrag, verdeling, omschrijving")
        .eq("boekjaar_id", boekjaarId)
        .eq("categorie", categorie)
        .eq("omschrijving_extra", HERVERDELING_TAG),
    ]);

  const verschil = tellers == null ? null : round2(fact - tellers);

  let vorigVerschil: number | null = null;
  if (vorig && tellers != null) {
    const [vf, vt] = await Promise.all([
      facturen(db, vorig.id, categorie),
      viaTellers(db, vorig.id, categorie),
    ]);
    vorigVerschil = vt == null || vf === 0 ? null : round2(vf - vt);
  }

  const rijen = (tagged ?? []) as {
    bedrag: number;
    verdeling: string;
    omschrijving: string | null;
  }[];
  let actief: HerverdelingInfo["actief"] = null;
  if (rijen.length > 0) {
    const h = round2(
      rijen
        .filter((r) => r.verdeling === "gelijk_huurders")
        .reduce((s, r) => s + Number(r.bedrag), 0),
    );
    const e = round2(
      rijen
        .filter((r) => r.verdeling === "gelijk_eigenaars")
        .reduce((s, r) => s + Number(r.bedrag), 0),
    );
    const totaal = round2(h + e);
    actief = {
      bedrag: totaal,
      huurders: h,
      eigenaars: e,
      pctHuurders: totaal > 0 ? Math.round((h / totaal) * 1000) / 10 : 0,
      toelichting:
        rijen
          .find((r) => r.omschrijving?.includes(" — "))
          ?.omschrijving?.split(" — ")[1]
          ?.split(" · ")[0] ?? null,
    };
  }

  return {
    categorie,
    facturen: fact,
    viaTellers: tellers,
    verschil,
    vorigJaarVerschil: vorigVerschil,
    voorstel:
      verschil == null
        ? null
        : Math.max(0, round2(verschil - Math.max(0, vorigVerschil ?? 0))),
    aantalEigenaars: aantalUnits ?? 4,
    actief,
  };
}

export interface HerverdelingInvoer {
  vme_id: string;
  boekjaar_id: string;
  categorie: string;
  bedrag: number;
  pct_huurders: number;
  toelichting: string;
}

/**
 * Schrijft de herverdeling weg (vervangt een eerdere van dezelfde categorie).
 * Geeft een foutmelding terug, of de toegewezen bedragen.
 */
export async function zetHerverdeling(
  db: Db,
  inv: HerverdelingInvoer,
): Promise<{ error: string } | { huurders: number; eigenaars: number }> {
  const bedrag = round2(inv.bedrag);
  const pct = inv.pct_huurders;
  if (!(bedrag > 0)) return { error: "Geef een bedrag groter dan 0." };
  if (!(pct >= 0 && pct <= 100))
    return { error: "Het aandeel van de huurders moet tussen 0 en 100 % liggen." };

  const { data: bj } = await db
    .from("boekjaar")
    .select("id, vme_id, eind_datum, status")
    .eq("id", inv.boekjaar_id)
    .maybeSingle<{ id: string; vme_id: string; eind_datum: string; status: string }>();
  if (!bj || bj.vme_id !== inv.vme_id) return { error: "Boekjaar niet gevonden." };
  if (bj.status === "afgesloten") return { error: "Dit boekjaar is afgesloten." };

  const huurders = round2((bedrag * pct) / 100);
  const eigenaars = round2(bedrag - huurders);
  const basis = {
    vme_id: inv.vme_id,
    boekjaar_id: inv.boekjaar_id,
    categorie: inv.categorie,
    rekening: "zicht" as const,
    datum: bj.eind_datum,
    leverancier: "Algemene vergadering",
    verdeelsleutel_id: null,
    bron: "manueel" as const,
    status: "bevestigd" as const,
    omschrijving_extra: HERVERDELING_TAG,
  };
  const omschr = `Herverdeling AV (${inv.categorie}) — ${inv.toelichting}`;
  const rijen = [
    {
      ...basis,
      bedrag: -bedrag,
      verdeling: "individueel_verbruik",
      betaler_type: "huurder",
      omschrijving: `${omschr} · extra uit verbruiksfacturen gehaald`,
    },
    ...(huurders > 0
      ? [{ ...basis, bedrag: huurders, verdeling: "gelijk_huurders", betaler_type: "huurder", omschrijving: `${omschr} · deel huurders (${pct} %)` }]
      : []),
    ...(eigenaars > 0
      ? [{ ...basis, bedrag: eigenaars, verdeling: "gelijk_eigenaars", betaler_type: "eigenaar", omschrijving: `${omschr} · deel eigenaars (${round2(100 - pct)} %)` }]
      : []),
  ];

  // Eerst invoegen, dan pas de oude weghalen: er blijft altijd een geldige
  // herverdeling staan als iets halverwege misgaat.
  const { data: oud } = await db
    .from("kosten")
    .select("id")
    .eq("boekjaar_id", inv.boekjaar_id)
    .eq("categorie", inv.categorie)
    .eq("omschrijving_extra", HERVERDELING_TAG);
  const { error } = await db.from("kosten").insert(rijen);
  if (error) return { error: error.message };
  const oudeIds = ((oud ?? []) as { id: string }[]).map((r) => r.id);
  if (oudeIds.length > 0) {
    const { error: delErr } = await db.from("kosten").delete().in("id", oudeIds);
    if (delErr) return { error: delErr.message };
  }
  return { huurders, eigenaars };
}

/** Verwijdert de herverdeling van een categorie in een boekjaar. */
export async function wisHerverdeling(
  db: Db,
  boekjaarId: string,
  categorie: string,
): Promise<{ error: string } | null> {
  const { data: bj } = await db
    .from("boekjaar")
    .select("status")
    .eq("id", boekjaarId)
    .maybeSingle<{ status: string }>();
  if (bj?.status === "afgesloten") return { error: "Dit boekjaar is afgesloten." };
  const { error } = await db
    .from("kosten")
    .delete()
    .eq("boekjaar_id", boekjaarId)
    .eq("categorie", categorie)
    .eq("omschrijving_extra", HERVERDELING_TAG);
  return error ? { error: error.message } : null;
}
