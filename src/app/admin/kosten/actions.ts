"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  num,
  type ActionState,
} from "@/lib/action-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

async function uploadDocument(
  db: Db,
  vmeId: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${vmeId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await db.storage
    .from("documenten")
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Upload mislukt: ${error.message}`);
  return path;
}

export async function createKost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    const categorie = str(formData, "categorie");
    const datum = str(formData, "datum");
    if (!vme_id || !boekjaar_id || !categorie || !datum)
      return {
        ok: false,
        error: "Boekjaar, categorie, datum en bedrag zijn verplicht.",
      };

    const bedrag = num(formData, "bedrag");
    const fileEntry = formData.get("document");
    const document_url = await uploadDocument(
      db,
      vme_id,
      fileEntry instanceof File ? fileEntry : null,
    );

    const { error } = await db.from("kosten").insert({
      vme_id,
      boekjaar_id,
      categorie,
      omschrijving: optStr(formData, "omschrijving"),
      bedrag,
      datum,
      leverancier: optStr(formData, "leverancier"),
      verdeelsleutel_id: optStr(formData, "verdeelsleutel_id"),
      betaler_type: str(formData, "betaler_type") === "huurder" ? "huurder" : "eigenaar",
      document_url,
      bron: "manueel",
      status: "bevestigd",
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/kosten");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Kost geboekt." };
  });
}

export async function confirmKost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db
      .from("kosten")
      .update({ status: "bevestigd" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/kosten");
    return { ok: true, message: "Kost bevestigd." };
  });
}

export async function deleteKost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { data: row } = await db
      .from("kosten")
      .select("document_url")
      .eq("id", id)
      .maybeSingle<{ document_url: string | null }>();

    const { error } = await db.from("kosten").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    if (row?.document_url) {
      await db.storage.from("documenten").remove([row.document_url]);
    }
    revalidatePath("/admin/kosten");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Kost verwijderd." };
  });
}
