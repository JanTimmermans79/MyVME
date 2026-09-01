"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  num,
  type ActionState,
} from "@/lib/action-helpers";
import { EENHEIDSPRIJS_DEFAULTS, type TellerType } from "@/lib/types";

const TYPES: TellerType[] = ["koud_water", "warm_water", "cv"];

export async function maakTellers(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const unit_id = str(formData, "unit_id");
    if (!unit_id) return { ok: false, error: "Geen unit." };
    const { error } = await db
      .from("teller")
      .upsert(
        TYPES.map((type) => ({ unit_id, type })),
        { onConflict: "unit_id,type", ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/meterstanden");
    return { ok: true, message: "Tellers aangemaakt." };
  });
}

export async function setMeternummer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen teller." };
    const { error } = await db
      .from("teller")
      .update({ meternummer: optStr(formData, "meternummer") })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/meterstanden");
    return { ok: true, message: "Opgeslagen." };
  });
}

/** Legt in één keer de standen van de drie tellers van een unit vast. */
export async function nieuweMeterstanden(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const unit_id = str(formData, "unit_id");
    const datum = str(formData, "datum");
    const aanleiding = str(formData, "aanleiding") || "tussentijds";
    // Een huurder hangt enkel aan een huurderwissel-stand.
    const huurder_id =
      aanleiding === "huurderwissel" ? optStr(formData, "huurder_id") : null;
    if (!unit_id || !datum)
      return { ok: false, error: "Unit en datum zijn verplicht." };

    // Alleen standen binnen het gekozen boekjaar (paar dagen marge voor de
    // eindstand die soms 1-2 dagen voor/na de boekjaargrens opgenomen wordt).
    const bjStart = str(formData, "boekjaar_start");
    const bjEind = str(formData, "boekjaar_eind");
    if (bjStart && bjEind) {
      const marge = (d: string, dagen: number) => {
        const t = new Date(`${d}T00:00:00Z`);
        t.setUTCDate(t.getUTCDate() + dagen);
        return t.toISOString().slice(0, 10);
      };
      if (datum < marge(bjStart, -3) || datum > marge(bjEind, 3))
        return {
          ok: false,
          error: `Datum valt buiten het boekjaar (${bjStart} – ${bjEind}). Kies het juiste boekjaar bovenaan.`,
        };
    }

    const { data: tellers } = await db
      .from("teller")
      .select("id, type")
      .eq("unit_id", unit_id);
    if (!tellers || tellers.length === 0)
      return { ok: false, error: "Maak eerst de tellers aan voor deze unit." };

    const rows: {
      teller_id: string;
      datum: string;
      waarde: number;
      aanleiding: string;
      huurder_id: string | null;
    }[] = [];
    for (const t of tellers as { id: string; type: string }[]) {
      const raw = str(formData, `waarde_${t.type}`);
      if (raw === "") continue;
      const waarde = num(formData, `waarde_${t.type}`);
      if (waarde < 0)
        return { ok: false, error: "Meterstanden mogen niet negatief zijn." };
      rows.push({ teller_id: t.id, datum, waarde, aanleiding, huurder_id });
    }
    if (rows.length === 0)
      return { ok: false, error: "Vul minstens één meterstand in." };

    const { error } = await db.from("meterstand").insert(rows);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/meterstanden");
    return { ok: true, message: `${rows.length} meterstand(en) opgeslagen.` };
  });
}

export async function verwijderMeterstand(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const ids = str(formData, "ids")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const enkel = str(formData, "id");
    const teVerwijderen = ids.length ? ids : enkel ? [enkel] : [];
    if (teVerwijderen.length === 0)
      return { ok: false, error: "Geen meterstand." };
    const { error } = await db
      .from("meterstand")
      .delete()
      .in("id", teVerwijderen);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/meterstanden");
    return {
      ok: true,
      message:
        teVerwijderen.length > 1
          ? `${teVerwijderen.length} meterstanden verwijderd.`
          : "Meterstand verwijderd.",
    };
  });
}

/** Past een bestaande opname aan (datum/aanleiding/waarden van de drie tellers). */
export async function updateMeterstanden(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const datum = str(formData, "datum");
    const aanleiding = str(formData, "aanleiding") || "tussentijds";
    const huurder_id = optStr(formData, "huurder_id");
    if (!datum) return { ok: false, error: "Datum is verplicht." };

    const bjStart = str(formData, "boekjaar_start");
    const bjEind = str(formData, "boekjaar_eind");
    if (bjStart && bjEind) {
      const marge = (d: string, dagen: number) => {
        const t = new Date(`${d}T00:00:00Z`);
        t.setUTCDate(t.getUTCDate() + dagen);
        return t.toISOString().slice(0, 10);
      };
      if (datum < marge(bjStart, -3) || datum > marge(bjEind, 3))
        return {
          ok: false,
          error: `Datum valt buiten het boekjaar (${bjStart} – ${bjEind}).`,
        };
    }

    // huurder_id volgt de aanleiding: enkel een huurderwissel draagt een huurder.
    const patchBasis = {
      datum,
      aanleiding,
      huurder_id: aanleiding === "huurderwissel" ? huurder_id : null,
    };

    let n = 0;
    for (const type of TYPES) {
      const id = str(formData, `id_${type}`);
      if (!id) continue;
      const raw = str(formData, `waarde_${type}`);
      if (raw === "") continue; // leeg laten = niet wijzigen; verwijderen apart
      const waarde = num(formData, `waarde_${type}`);
      if (waarde < 0)
        return { ok: false, error: "Meterstanden mogen niet negatief zijn." };
      const { error } = await db
        .from("meterstand")
        .update({ ...patchBasis, waarde })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
      n += 1;
    }
    if (n === 0) return { ok: false, error: "Niets om aan te passen." };
    revalidatePath("/admin/meterstanden");
    return { ok: true, message: `${n} meterstand(en) bijgewerkt.` };
  });
}

export async function setEenheidsprijs(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    if (!vme_id || !boekjaar_id)
      return { ok: false, error: "VME en boekjaar zijn verplicht." };

    const rec = {
      vme_id,
      boekjaar_id,
      prijs_water_per_m3: num(formData, "prijs_water_per_m3"),
      mazoutprijs_per_liter: num(formData, "mazoutprijs_per_liter"),
      cv_liter_per_m3: num(formData, "cv_liter_per_m3"),
      warmwater_liter_per_m3: num(formData, "warmwater_liter_per_m3"),
      administratie_pct: Math.min(100, Math.max(0, num(formData, "administratie_pct"))),
    };
    const { error } = await db
      .from("eenheidsprijs")
      .upsert(rec, { onConflict: "vme_id,boekjaar_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/meterstanden");
    return { ok: true, message: "Eenheidsprijzen opgeslagen." };
  });
}

/** Berekent de gewogen gemiddelde mazoutprijs uit de leveringen van het boekjaar. */
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
    revalidatePath("/admin/meterstanden");
    return {
      ok: true,
      message: `Mazoutprijs ingesteld op € ${rec.mazoutprijs_per_liter.toFixed(4)}/l (gewogen gemiddelde).`,
    };
  });
}
