"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  num,
  type ActionState,
} from "@/lib/action-helpers";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadNaarDocumenten } from "@/lib/documenten-upload";
import { controleerTellerkeuze } from "@/lib/meteropname-validatie";
import { EENHEIDSPRIJS_DEFAULTS, type TellerType } from "@/lib/types";

const TYPES: TellerType[] = ["koud_water", "warm_water", "cv"];

const AANLEIDINGEN = new Set([
  "boekjaareinde",
  "einde_huurder",
  "start_huurder",
  "tussentijds",
  "huurderwissel",
]);

/** Aanleidingen die aan een specifieke huurder hangen. */
const HUURDER_AANLEIDINGEN = new Set([
  "einde_huurder",
  "start_huurder",
  "huurderwissel",
]);

/** Ligt `datum` (paar dagen marge) binnen het boekjaar? */
function buitenBoekjaar(
  datum: string,
  bjStart: string,
  bjEind: string,
): string | null {
  if (!bjStart || !bjEind) return null;
  const marge = (d: string, dagen: number) => {
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + dagen);
    return t.toISOString().slice(0, 10);
  };
  if (datum < marge(bjStart, -3) || datum > marge(bjEind, 3))
    return `Datum valt buiten het boekjaar (${bjStart} – ${bjEind}).`;
  return null;
}

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
    // Een huurder hangt enkel aan een einde/start-huurder-stand.
    const huurder_id = HUURDER_AANLEIDINGEN.has(aanleiding)
      ? optStr(formData, "huurder_id")
      : null;
    if (!unit_id || !datum)
      return { ok: false, error: "Unit en datum zijn verplicht." };
    if (HUURDER_AANLEIDINGEN.has(aanleiding) && !huurder_id)
      return {
        ok: false,
        error: "Kies de huurder bij een einde- of startstand.",
      };

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

    // huurder_id volgt de aanleiding: enkel einde/start-huurder draagt een huurder.
    const draagtHuurder = HUURDER_AANLEIDINGEN.has(aanleiding);
    if (draagtHuurder && !huurder_id)
      return {
        ok: false,
        error: "Kies de huurder bij een einde- of startstand.",
      };
    const patchBasis = {
      datum,
      aanleiding,
      huurder_id: draagtHuurder ? huurder_id : null,
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

// ---------------------------------------------------------------------------
// Meterstand via foto (syndicus-kant)
// ---------------------------------------------------------------------------

const optDrie = (formData: FormData, key: string): number | null => {
  const raw = optStr(formData, key);
  if (raw == null) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export type BewaarMeterfotoResultaat =
  | { ok: true; opname_id: string; document_id: string }
  | { ok: false; error: string };

/**
 * Bewaart een geüploade tellerfoto, koppelt ze aan de VME en zet ze als
 * `meteropname` (rol 'syndicus', status 'nieuw') in de inbox. Imperatief
 * aangeroepen vanuit de client — eigen resultaattype i.p.v. ActionState.
 */
export async function bewaarMeterfoto(
  formData: FormData,
): Promise<BewaarMeterfotoResultaat> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Geen toegang." };
  }
  try {
    const vme_id = str(formData, "vme_id");
    const unit_id = str(formData, "unit_id");
    const file = formData.get("file");
    if (!vme_id || !unit_id || !(file instanceof File) || file.size === 0)
      return { ok: false, error: "Geen foto ontvangen." };
    if (!file.type.startsWith("image/"))
      return { ok: false, error: "Enkel een foto (afbeelding) van de teller." };
    if (file.size > 8 * 1024 * 1024)
      return { ok: false, error: "De foto is groter dan 8 MB." };

    const db = createAdminClient();

    const controle = await controleerTellerkeuze(db, {
      vmeId: vme_id,
      unitId: unit_id,
      tellerId: optStr(formData, "teller_id"),
      herkendMeternummer: optStr(formData, "herkend_meternummer"),
      bevestigdEigenTeller: true, // syndicus: geen bevestigingsvinkje
      rol: "syndicus",
    });
    if (!controle.ok) return { ok: false, error: controle.error };

    const pad = await uploadNaarDocumenten(db, vme_id, file);
    const { data: doc, error: docErr } = await db
      .from("document")
      .insert({
        vme_id,
        boekjaar_id: optStr(formData, "boekjaar_id"),
        naam: file.name,
        pad,
        mimetype: file.type || null,
        grootte: file.size,
        categorie: "meterstand",
      })
      .select("id")
      .single();
    if (docErr) return { ok: false, error: docErr.message };

    const herkende_waarde = optDrie(formData, "herkende_waarde");
    const { data: opname, error } = await db
      .from("meteropname")
      .insert({
        vme_id,
        unit_id,
        teller_id: optStr(formData, "teller_id"),
        boekjaar_id: optStr(formData, "boekjaar_id"),
        document_id: doc.id as string,
        rol: "syndicus",
        opname_datum: optStr(formData, "opname_datum"),
        herkende_waarde,
        herkend_meternummer: optStr(formData, "herkend_meternummer"),
        waarde: herkende_waarde,
        status: "nieuw",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/meterstanden");
    revalidatePath("/admin/documenten");
    return {
      ok: true,
      opname_id: opname.id as string,
      document_id: doc.id as string,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Onbekende fout.",
    };
  }
}

/** Bevestigt een foto-opname → maakt er een echte `meterstand` van. */
export async function bevestigMeteropname(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const opname_id = str(formData, "opname_id");
    const teller_id = str(formData, "teller_id");
    const datum = str(formData, "datum");
    const aanleiding = str(formData, "aanleiding") || "boekjaareinde";
    const huurder_id = HUURDER_AANLEIDINGEN.has(aanleiding)
      ? optStr(formData, "huurder_id")
      : null;
    if (!opname_id || !teller_id || !datum)
      return { ok: false, error: "Teller en datum zijn verplicht." };
    if (!AANLEIDINGEN.has(aanleiding))
      return { ok: false, error: "Ongeldige aanleiding." };
    if (HUURDER_AANLEIDINGEN.has(aanleiding) && !huurder_id)
      return { ok: false, error: "Kies de huurder bij een einde-/startstand." };

    const bjFout = buitenBoekjaar(
      datum,
      str(formData, "boekjaar_start"),
      str(formData, "boekjaar_eind"),
    );
    if (bjFout) return { ok: false, error: bjFout };

    const waarde = num(formData, "waarde");
    if (waarde < 0)
      return { ok: false, error: "Meterstand mag niet negatief zijn." };

    const { data: stand, error } = await db
      .from("meterstand")
      .insert({ teller_id, datum, waarde, aanleiding, huurder_id })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    const { error: updErr } = await db
      .from("meteropname")
      .update({
        status: "verwerkt",
        meterstand_id: stand.id as string,
        teller_id,
        waarde,
        opname_datum: datum,
      })
      .eq("id", opname_id);
    if (updErr) return { ok: false, error: updErr.message };

    revalidatePath("/admin/meterstanden");
    return { ok: true, message: "Meterstand opgeslagen." };
  });
}

/** Wijst een foto-opname af (wordt geen meterstand). */
export async function wijsMeteropnameAf(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const opname_id = str(formData, "opname_id");
    if (!opname_id) return { ok: false, error: "Geen opname." };
    const { error } = await db
      .from("meteropname")
      .update({ status: "afgewezen", opmerking: optStr(formData, "opmerking") })
      .eq("id", opname_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/meterstanden");
    return { ok: true, message: "Foto-opname afgewezen." };
  });
}
