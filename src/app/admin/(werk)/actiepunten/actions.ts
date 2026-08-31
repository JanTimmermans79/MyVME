"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";
import type { ActiepuntStatus } from "@/lib/types";

const STATUSSEN: ActiepuntStatus[] = ["open", "bezig", "afgewerkt"];

function velden(formData: FormData) {
  return {
    titel: str(formData, "titel").trim(),
    omschrijving: optStr(formData, "omschrijving"),
    deadline: optStr(formData, "deadline"),
    verantwoordelijke: optStr(formData, "verantwoordelijke"),
    boekjaar_id: optStr(formData, "boekjaar_id"),
    document_id: optStr(formData, "document_id"),
  };
}

export async function createActiepunt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const v = velden(formData);
    if (!vme_id || !v.titel)
      return { ok: false, error: "Titel is verplicht." };
    const { error } = await db.from("actiepunt").insert({ vme_id, ...v });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/actiepunten");
    return { ok: true, message: "Actiepunt toegevoegd." };
  });
}

export async function updateActiepunt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const v = velden(formData);
    if (!id || !v.titel) return { ok: false, error: "Titel is verplicht." };
    const { error } = await db.from("actiepunt").update(v).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/actiepunten");
    return { ok: true, message: "Actiepunt bijgewerkt." };
  });
}

export async function setActiepuntStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const status = str(formData, "status") as ActiepuntStatus;
    if (!id || !STATUSSEN.includes(status))
      return { ok: false, error: "Ongeldige status." };
    const { error } = await db
      .from("actiepunt")
      .update({
        status,
        afgewerkt_op: status === "afgewerkt" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/actiepunten");
    return { ok: true };
  });
}

export async function deleteActiepunt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("actiepunt").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/actiepunten");
    return { ok: true, message: "Actiepunt verwijderd." };
  });
}

/**
 * Neemt actiepunten over uit geplakte tekst (jaarverslag / notulen): één punt
 * per regel, opsommingstekens en nummering worden weggehaald.
 */
export async function importActiepunten(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = optStr(formData, "boekjaar_id");
    const document_id = optStr(formData, "document_id");
    const tekst = str(formData, "tekst");
    if (!vme_id || !tekst.trim())
      return { ok: false, error: "Plak eerst tekst." };

    const regels = tekst
      .split(/\r?\n/)
      .map((r) =>
        r
          .replace(/^\s*(?:[-*•·]|\d+[.)]|[a-z][.)])\s+/i, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((r) => r.length >= 4);

    if (regels.length === 0)
      return { ok: false, error: "Geen bruikbare regels gevonden." };

    const rows = regels.map((titel) => ({
      vme_id,
      boekjaar_id,
      document_id,
      titel: titel.length > 200 ? titel.slice(0, 200) : titel,
      omschrijving: titel.length > 200 ? titel : null,
      bron: "jaarverslag" as const,
    }));
    const { error } = await db.from("actiepunt").insert(rows);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/actiepunten");
    return { ok: true, message: `${rows.length} actiepunt(en) overgenomen.` };
  });
}
