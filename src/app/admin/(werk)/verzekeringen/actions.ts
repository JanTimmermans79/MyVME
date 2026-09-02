"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadNaarDocumenten } from "@/lib/documenten-upload";
import { extraheerPolis, type PolisExtract } from "@/lib/verzekering-extract";
import type { PolisType, SchadeStatus } from "@/lib/types";

const POLIS_TYPES: PolisType[] = [
  "brand",
  "ba_gebouw",
  "rechtsbijstand",
  "bestuurdersaansprakelijkheid",
  "objectieve_aansprakelijkheid",
  "overig",
];
const SCHADE_STATUSSEN: SchadeStatus[] = [
  "gemeld",
  "in_behandeling",
  "afgehandeld",
  "geweigerd",
];

const optNum = (formData: FormData, key: string): number | null => {
  const raw = optStr(formData, key);
  if (raw == null) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const optDate = (formData: FormData, key: string): string | null => {
  const v = str(formData, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

function revalidate(polisId?: string) {
  revalidatePath("/admin/verzekeringen");
  if (polisId) revalidatePath(`/admin/verzekeringen/${polisId}`);
}

// --- Polis via document (drag-and-drop) --------------------------------

export type VerwerkPolisResultaat =
  | { ok: true; document_id: string; naam: string; extract: PolisExtract }
  | { ok: false; error: string };

/**
 * Bewaart een geüpload polisdocument, koppelt het aan de VME en probeert de
 * polisvelden af te leiden (zie extraheerPolis). Wordt imperatief aangeroepen
 * vanuit de dropzone, dus geen ActionState maar een eigen resultaattype.
 */
export async function verwerkPolisDocument(
  formData: FormData,
): Promise<VerwerkPolisResultaat> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Geen toegang." };
  }
  try {
    const vme_id = str(formData, "vme_id");
    const file = formData.get("file");
    if (!vme_id || !(file instanceof File) || file.size === 0)
      return { ok: false, error: "Geen bestand ontvangen." };
    const isPdf = file.type === "application/pdf";
    const isImg = file.type.startsWith("image/");
    if (!isPdf && !isImg)
      return { ok: false, error: "Enkel een PDF of afbeelding van de polis." };
    if (file.size > 8 * 1024 * 1024)
      return { ok: false, error: "Bestand is groter dan 8 MB." };

    const db = createAdminClient();
    const pad = await uploadNaarDocumenten(db, vme_id, file);
    const { data, error } = await db
      .from("document")
      .insert({
        vme_id,
        naam: file.name,
        pad,
        mimetype: file.type || null,
        grootte: file.size,
        categorie: "verzekering",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    let extract: PolisExtract;
    try {
      extract = await extraheerPolis(db, vme_id, file.name);
    } catch {
      extract = { bron: "geen" };
    }

    revalidatePath("/admin/verzekeringen");
    revalidatePath("/admin/documenten");
    return { ok: true, document_id: data.id as string, naam: file.name, extract };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Onbekende fout.",
    };
  }
}

// --- Polissen ------------------------------------------------------------

function polisVelden(formData: FormData) {
  const type = str(formData, "type") as PolisType;
  return {
    maatschappij: str(formData, "maatschappij"),
    polisnummer: optStr(formData, "polisnummer"),
    type: POLIS_TYPES.includes(type) ? type : "brand",
    jaarpremie: optNum(formData, "jaarpremie"),
    ingang_datum: optDate(formData, "ingang_datum"),
    vervaldatum: optDate(formData, "vervaldatum"),
    hoofdvervaldag: optStr(formData, "hoofdvervaldag"),
    makelaar: optStr(formData, "makelaar"),
    document_id: optStr(formData, "document_id"),
    opmerkingen: optStr(formData, "opmerkingen"),
  };
}

export async function createPolis(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const v = polisVelden(formData);
    if (!vme_id || !v.maatschappij)
      return { ok: false, error: "Maatschappij is verplicht." };
    const { error } = await db
      .from("verzekering_polis")
      .insert({ vme_id, ...v });
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, message: "Polis toegevoegd." };
  });
}

export async function updatePolis(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const v = polisVelden(formData);
    if (!id || !v.maatschappij)
      return { ok: false, error: "Maatschappij is verplicht." };
    const { error } = await db
      .from("verzekering_polis")
      .update(v)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate(id);
    return { ok: true, message: "Polis bijgewerkt." };
  });
}

export async function setPolisActief(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const actief = str(formData, "actief") === "ja";
    if (!id) return { ok: false, error: "Geen polis." };
    const { error } = await db
      .from("verzekering_polis")
      .update({ actief })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate(id);
    return { ok: true };
  });
}

export async function deletePolis(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("verzekering_polis").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, message: "Polis verwijderd." };
  });
}

// --- Schade -------------------------------------------------------------

function schadeVelden(formData: FormData) {
  const status = str(formData, "status") as SchadeStatus;
  return {
    datum: str(formData, "datum"),
    omschrijving: str(formData, "omschrijving"),
    status: SCHADE_STATUSSEN.includes(status) ? status : "gemeld",
    dossiernummer: optStr(formData, "dossiernummer"),
    schadebedrag: optNum(formData, "schadebedrag"),
    uitgekeerd_bedrag: optNum(formData, "uitgekeerd_bedrag"),
    unit_id: optStr(formData, "unit_id"),
    document_id: optStr(formData, "document_id"),
  };
}

export async function createSchade(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const polis_id = str(formData, "polis_id");
    const v = schadeVelden(formData);
    if (!vme_id || !polis_id || !v.datum || !v.omschrijving)
      return { ok: false, error: "Datum en omschrijving zijn verplicht." };
    const { error } = await db
      .from("verzekering_schade")
      .insert({ vme_id, polis_id, ...v });
    if (error) return { ok: false, error: error.message };
    revalidate(polis_id);
    return { ok: true, message: "Schadedossier toegevoegd." };
  });
}

export async function updateSchade(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const polis_id = str(formData, "polis_id");
    const v = schadeVelden(formData);
    if (!id || !v.datum || !v.omschrijving)
      return { ok: false, error: "Datum en omschrijving zijn verplicht." };
    const { error } = await db
      .from("verzekering_schade")
      .update(v)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate(polis_id);
    return { ok: true, message: "Schadedossier bijgewerkt." };
  });
}

export async function deleteSchade(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const polis_id = str(formData, "polis_id");
    const { error } = await db.from("verzekering_schade").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate(polis_id);
    return { ok: true, message: "Schadedossier verwijderd." };
  });
}
