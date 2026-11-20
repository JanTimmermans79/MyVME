"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  num,
  type ActionState,
} from "@/lib/action-helpers";
import { EENHEIDSPRIJS_DEFAULTS } from "@/lib/types";

const optGetal = (formData: FormData, key: string): number | null => {
  const raw = optStr(formData, key);
  if (raw == null) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const MIGRATIE =
  "supabase/migrations/20261116100000_water_tarief.sql";

function revalideer() {
  revalidatePath("/admin/tarieven");
  revalidatePath("/admin/meterstanden");
  revalidatePath("/admin/afrekeningen");
}

/** Tarieven & parameters van één boekjaar (water, mazout, administratie, syndicus). */
export async function setTarieven(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    if (!vme_id || !boekjaar_id)
      return { ok: false, error: "VME en boekjaar zijn verplicht." };

    const pct = (key: string) => Math.min(100, Math.max(0, num(formData, key)));
    const rec = {
      vme_id,
      boekjaar_id,
      prijs_water_per_m3: num(formData, "prijs_water_per_m3"),
      mazoutprijs_per_liter: num(formData, "mazoutprijs_per_liter"),
      cv_liter_per_m3: num(formData, "cv_liter_per_m3"),
      warmwater_liter_per_m3: num(formData, "warmwater_liter_per_m3"),
      administratie_pct: pct("administratie_pct"),
    };

    // Water: basisvolume + basistarief ingevuld = basis-/comforttarief in gebruik.
    // Een leeg comforttarief wordt 2 × het basistarief (wettelijke verhouding).
    // Alles leeg = de vaste prijs per m³. Alleen het basisvolume of alleen het
    // basistarief is een vergissing.
    // Basisvolume: ingegeven in liter (nieuw veld) of, voor oude formulieren, in m³.
    const liter = optGetal(formData, "water_basisvolume_liter");
    const basisvolume =
      liter != null
        ? Math.round((liter / 1000) * 100) / 100
        : optGetal(formData, "water_basisvolume_m3");
    if (basisvolume != null && basisvolume > 5000)
      return {
        ok: false,
        error: `Een basisvolume van ${basisvolume.toLocaleString("nl-BE")} m³ per jaar lijkt veel te hoog voor één gebouw. Geef het volume in liter in (bv. 360000 voor 360 m³).`,
      };
    const basis = optGetal(formData, "water_basis_per_m3");
    let comfort = optGetal(formData, "water_comfort_per_m3");
    const aantalIngevuld = [basisvolume, basis, comfort].filter(
      (v) => v != null,
    ).length;
    if (aantalIngevuld > 0 && (basisvolume == null || basis == null))
      return {
        ok: false,
        error:
          "Vul zowel het basisvolume (m³) als het basistarief in (of laat het basisvolume, basis- en comforttarief alle drie leeg voor de vaste waterprijs).",
      };
    if (basis != null && comfort == null) comfort = Math.round(basis * 2 * 10000) / 10000;
    const water = {
      water_basisvolume_m3: basisvolume,
      water_basis_per_m3: basis,
      water_comfort_per_m3: comfort,
    };
    const syndicus = { syndicus_pct_huurders: pct("syndicus_pct_huurders") };

    const nieuweKolommen = { ...water, ...syndicus };
    const { error } = await db
      .from("eenheidsprijs")
      .upsert({ ...rec, ...nieuweKolommen }, { onConflict: "vme_id,boekjaar_id" });
    if (error) {
      if (/water_(basis|comfort)|syndicus_pct/.test(error.message)) {
        // Migratie nog niet uitgevoerd: de basisgegevens kunnen wel opgeslagen worden.
        const gebruiktNieuw =
          aantalIngevuld > 0 || syndicus.syndicus_pct_huurders > 0;
        if (gebruiktNieuw)
          return {
            ok: false,
            error: `Het basis-/comforttarief en het syndicus-% kunnen pas opgeslagen worden nadat de migratie ${MIGRATIE} in de Supabase SQL Editor is uitgevoerd.`,
          };
        const { error: err2 } = await db
          .from("eenheidsprijs")
          .upsert(rec, { onConflict: "vme_id,boekjaar_id" });
        if (err2) return { ok: false, error: err2.message };
      } else return { ok: false, error: error.message };
    }
    revalideer();
    return { ok: true, message: "Tarieven opgeslagen." };
  });
}

export async function mazoutprijsUitLeveringen(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    if (!vme_id || !boekjaar_id) return { ok: false, error: "Ontbrekende gegevens." };

    const { data: bj } = await db
      .from("boekjaar")
      .select("start_datum, eind_datum")
      .eq("id", boekjaar_id)
      .maybeSingle<{ start_datum: string; eind_datum: string }>();
    if (!bj) return { ok: false, error: "Boekjaar niet gevonden." };

    const { data: lev } = await db
      .from("mazout_levering")
      .select("liter, prijs_per_liter")
      .eq("vme_id", vme_id)
      .gte("datum", bj.start_datum)
      .lte("datum", bj.eind_datum);

    const rows = (lev ?? []) as { liter: number; prijs_per_liter: number }[];
    const totLiter = rows.reduce((s, r) => s + Number(r.liter), 0);
    if (totLiter <= 0)
      return {
        ok: false,
        error: "Geen mazoutleveringen in dit boekjaar gevonden.",
      };
    const gewogen =
      rows.reduce((s, r) => s + Number(r.liter) * Number(r.prijs_per_liter), 0) /
      totLiter;

    const current = await db
      .from("eenheidsprijs")
      .select("*")
      .eq("vme_id", vme_id)
      .eq("boekjaar_id", boekjaar_id)
      .maybeSingle();

    const rec = {
      vme_id,
      boekjaar_id,
      prijs_water_per_m3:
        current.data?.prijs_water_per_m3 ??
        EENHEIDSPRIJS_DEFAULTS.prijs_water_per_m3,
      cv_liter_per_m3:
        current.data?.cv_liter_per_m3 ?? EENHEIDSPRIJS_DEFAULTS.cv_liter_per_m3,
      warmwater_liter_per_m3:
        current.data?.warmwater_liter_per_m3 ??
        EENHEIDSPRIJS_DEFAULTS.warmwater_liter_per_m3,
      administratie_pct:
        current.data?.administratie_pct ??
        EENHEIDSPRIJS_DEFAULTS.administratie_pct,
      mazoutprijs_per_liter: Math.round(gewogen * 10000) / 10000,
    };
    const { error } = await db
      .from("eenheidsprijs")
      .upsert(rec, { onConflict: "vme_id,boekjaar_id" });
    if (error) return { ok: false, error: error.message };
    revalideer();
    return {
      ok: true,
      message: `Mazoutprijs ingesteld op € ${rec.mazoutprijs_per_liter.toFixed(4)}/l (gewogen gemiddelde).`,
    };
  });
}
