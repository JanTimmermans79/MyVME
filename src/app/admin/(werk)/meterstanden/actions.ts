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
import type { TellerType } from "@/lib/types";

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

const nlDatum = (d: string) => d.split("-").reverse().join("/");

/**
 * Meterstanden horen bij het gekozen boekjaar: een datum buiten dat boekjaar
 * geeft een melding (met het boekjaar waar de datum wel bij hoort).
 */
async function controleerBoekjaarDatum(
  db: ReturnType<typeof createAdminClient>,
  datum: string,
  bjStart: string,
  bjEind: string,
): Promise<string | null> {
  if (!bjStart || !bjEind) return null;
  if (datum >= bjStart && datum <= bjEind) return null;

  const { data: gekozen } = await db
    .from("boekjaar")
    .select("vme_id")
    .eq("start_datum", bjStart)
    .eq("eind_datum", bjEind)
    .limit(1)
    .maybeSingle<{ vme_id: string }>();
  let ander: { start_datum: string; eind_datum: string } | null = null;
  if (gekozen) {
    const { data } = await db
      .from("boekjaar")
      .select("start_datum, eind_datum")
      .eq("vme_id", gekozen.vme_id)
      .lte("start_datum", datum)
      .gte("eind_datum", datum)
      .limit(1)
      .maybeSingle<{ start_datum: string; eind_datum: string }>();
    ander = data;
  }
  const basis = `De datum ${nlDatum(datum)} ligt niet in het gekozen boekjaar (${nlDatum(bjStart)} – ${nlDatum(bjEind)}).`;
  return ander
    ? `${basis} Ze hoort bij boekjaar ${nlDatum(ander.start_datum)} – ${nlDatum(ander.eind_datum)}: kies dat boekjaar bovenaan en geef de stand daar in.`
    : `${basis} Er bestaat geen boekjaar voor deze datum.`;
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

    const bjFout = await controleerBoekjaarDatum(
      db,
      datum,
      str(formData, "boekjaar_start"),
      str(formData, "boekjaar_eind"),
    );
    if (bjFout) return { ok: false, error: bjFout };

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

    const bjFout = await controleerBoekjaarDatum(
      db,
      datum,
      str(formData, "boekjaar_start"),
      str(formData, "boekjaar_eind"),
    );
    if (bjFout) return { ok: false, error: bjFout };

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

    const bjFout = await controleerBoekjaarDatum(
      db,
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
