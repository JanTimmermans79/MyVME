"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, optStr, type ActionState } from "@/lib/action-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

async function upload(db: Db, vmeId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const pad = `${vmeId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await db.storage
    .from("documenten")
    .upload(pad, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Upload mislukt: ${error.message}`);
  return pad;
}

export async function uploadDocumenten(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    if (!vme_id) return { ok: false, error: "Geen VME." };
    const boekjaar_id = optStr(formData, "boekjaar_id");
    const categorie = optStr(formData, "categorie");

    const files = formData
      .getAll("bestanden")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0)
      return { ok: false, error: "Kies minstens één bestand." };

    const rijen = [];
    for (const file of files) {
      const pad = await upload(db, vme_id, file);
      rijen.push({
        vme_id,
        boekjaar_id,
        naam: file.name,
        pad,
        mimetype: file.type || null,
        grootte: file.size,
        categorie,
      });
    }

    const { error } = await db.from("document").insert(rijen);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/documenten");
    return {
      ok: true,
      message: `${rijen.length} document(en) geüpload.`,
    };
  });
}

export async function deleteDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen document." };

    const { data: row } = await db
      .from("document")
      .select("pad")
      .eq("id", id)
      .maybeSingle<{ pad: string }>();

    const { error } = await db.from("document").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    if (row?.pad) await db.storage.from("documenten").remove([row.pad]);

    revalidatePath("/admin/documenten");
    return { ok: true, message: "Document verwijderd." };
  });
}
