"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";
import type { Aanwezigheid, AvMeerderheid, AvStatus, AvType } from "@/lib/types";

const TYPES: AvType[] = ["gewoon", "buitengewoon"];
const STATUSSEN: AvStatus[] = ["gepland", "gehouden", "geannuleerd"];
const MEERDERHEDEN: AvMeerderheid[] = [
  "informatief",
  "volstrekt",
  "twee_derde",
  "vier_vijfde",
  "unaniem",
];
const AANWEZIGHEDEN: Aanwezigheid[] = ["aanwezig", "volmacht", "afwezig"];

const optNum = (formData: FormData, key: string): number | null => {
  const raw = optStr(formData, key);
  if (raw == null) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function revalidateAv(avId?: string) {
  revalidatePath("/admin/av");
  if (avId) revalidatePath(`/admin/av/${avId}`);
}

// --- Vergadering -----------------------------------------------------------

export async function createAv(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const datum = str(formData, "datum");
    const type = str(formData, "type") as AvType;
    if (!vme_id || !datum) return { ok: false, error: "Datum is verplicht." };
    const { error } = await db.from("av_vergadering").insert({
      vme_id,
      datum,
      type: TYPES.includes(type) ? type : "gewoon",
      locatie: optStr(formData, "locatie"),
      status: "gepland",
      boekjaar_id: optStr(formData, "boekjaar_id"),
      omschrijving: optStr(formData, "omschrijving"),
    });
    if (error) return { ok: false, error: error.message };
    revalidateAv();
    return { ok: true, message: "AV aangemaakt." };
  });
}

export async function updateAv(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const datum = str(formData, "datum");
    const type = str(formData, "type") as AvType;
    if (!id || !datum) return { ok: false, error: "Datum is verplicht." };
    const { error } = await db
      .from("av_vergadering")
      .update({
        datum,
        type: TYPES.includes(type) ? type : "gewoon",
        locatie: optStr(formData, "locatie"),
        boekjaar_id: optStr(formData, "boekjaar_id"),
        notulen_document_id: optStr(formData, "document_id"),
        omschrijving: optStr(formData, "omschrijving"),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAv(id);
    return { ok: true, message: "AV bijgewerkt." };
  });
}

export async function setAvStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const status = str(formData, "status") as AvStatus;
    if (!id || !STATUSSEN.includes(status))
      return { ok: false, error: "Ongeldige status." };
    const { error } = await db
      .from("av_vergadering")
      .update({ status })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAv(id);
    return { ok: true };
  });
}

export async function deleteAv(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("av_vergadering").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAv();
    return { ok: true, message: "AV verwijderd." };
  });
}

// --- Aanwezigheid ---------------------------------------------------------

export async function setAanwezigheid(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const av_id = str(formData, "av_id");
    const vme_id = str(formData, "vme_id");
    const unit_id = str(formData, "unit_id");
    const aanwezigheid = str(formData, "aanwezigheid") as Aanwezigheid;
    if (!av_id || !vme_id || !unit_id || !AANWEZIGHEDEN.includes(aanwezigheid))
      return { ok: false, error: "Ongeldige aanwezigheid." };
    const { error } = await db.from("av_aanwezigheid").upsert(
      {
        av_id,
        vme_id,
        unit_id,
        aanwezigheid,
        volmacht_naam:
          aanwezigheid === "volmacht" ? optStr(formData, "volmacht_naam") : null,
      },
      { onConflict: "av_id,unit_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidateAv(av_id);
    return { ok: true };
  });
}

// --- Agendapunten --------------------------------------------------------

function agendaVelden(formData: FormData) {
  const meerderheid = str(formData, "meerderheid") as AvMeerderheid;
  return {
    titel: str(formData, "titel"),
    toelichting: optStr(formData, "toelichting"),
    meerderheid: MEERDERHEDEN.includes(meerderheid) ? meerderheid : "volstrekt",
    beslissing: optStr(formData, "beslissing"),
    stemmen_voor: optNum(formData, "stemmen_voor"),
    stemmen_tegen: optNum(formData, "stemmen_tegen"),
    stemmen_onthouding: optNum(formData, "stemmen_onthouding"),
  };
}

export async function createAgendapunt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const av_id = str(formData, "av_id");
    const vme_id = str(formData, "vme_id");
    const v = agendaVelden(formData);
    if (!av_id || !vme_id || !v.titel)
      return { ok: false, error: "Titel is verplicht." };
    const { data: laatste } = await db
      .from("av_agendapunt")
      .select("volgnr")
      .eq("av_id", av_id)
      .order("volgnr", { ascending: false })
      .limit(1)
      .maybeSingle<{ volgnr: number }>();
    const { error } = await db.from("av_agendapunt").insert({
      av_id,
      vme_id,
      volgnr: (laatste?.volgnr ?? 0) + 1,
      ...v,
    });
    if (error) return { ok: false, error: error.message };
    revalidateAv(av_id);
    return { ok: true, message: "Agendapunt toegevoegd." };
  });
}

export async function updateAgendapunt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const av_id = str(formData, "av_id");
    const v = agendaVelden(formData);
    if (!id || !v.titel) return { ok: false, error: "Titel is verplicht." };
    const aangenomenRaw = str(formData, "aangenomen"); // "", "ja", "nee"
    const aangenomen =
      aangenomenRaw === "ja" ? true : aangenomenRaw === "nee" ? false : null;
    const volgnr = optNum(formData, "volgnr");
    const { error } = await db
      .from("av_agendapunt")
      .update({ ...v, aangenomen, ...(volgnr != null ? { volgnr } : {}) })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAv(av_id);
    return { ok: true, message: "Agendapunt bijgewerkt." };
  });
}

export async function deleteAgendapunt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const av_id = str(formData, "av_id");
    const { error } = await db.from("av_agendapunt").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAv(av_id);
    return { ok: true, message: "Agendapunt verwijderd." };
  });
}

/** Maakt een actiepunt van een agendapunt/beslissing en koppelt het terug. */
export async function agendapuntNaarActiepunt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen agendapunt." };
    const { data: punt } = await db
      .from("av_agendapunt")
      .select("id, vme_id, av_id, titel, beslissing, toelichting")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        vme_id: string;
        av_id: string;
        titel: string;
        beslissing: string | null;
        toelichting: string | null;
      }>();
    if (!punt) return { ok: false, error: "Agendapunt niet gevonden." };
    const { data: av } = await db
      .from("av_vergadering")
      .select("datum, boekjaar_id")
      .eq("id", punt.av_id)
      .maybeSingle<{ datum: string; boekjaar_id: string | null }>();

    const { data: nieuw, error } = await db
      .from("actiepunt")
      .insert({
        vme_id: punt.vme_id,
        boekjaar_id: av?.boekjaar_id ?? null,
        titel: `AV ${av?.datum ?? ""}: ${punt.titel}`.trim(),
        omschrijving: punt.beslissing ?? punt.toelichting ?? null,
        bron: "av",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    await db
      .from("av_agendapunt")
      .update({ actiepunt_id: nieuw.id })
      .eq("id", id);
    revalidateAv(punt.av_id);
    revalidatePath("/admin/actiepunten");
    return { ok: true, message: "Actiepunt aangemaakt." };
  });
}
