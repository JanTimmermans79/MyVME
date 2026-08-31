"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";

const GROEPEN = ["verbruik", "divers", "eigenaar"];

export async function createCategorie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const naam = str(formData, "naam");
    const groep = str(formData, "groep");
    if (!vme_id || !naam) return { ok: false, error: "Naam is verplicht." };
    const { error } = await db.from("categorie").insert({
      vme_id,
      naam,
      groep: GROEPEN.includes(groep) ? groep : "divers",
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/categorieen");
    return { ok: true, message: "Categorie toegevoegd." };
  });
}

export async function updateCategorie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const naam = str(formData, "naam");
    const groep = str(formData, "groep");
    if (!id || !naam) return { ok: false, error: "Naam is verplicht." };
    const { error } = await db
      .from("categorie")
      .update({
        naam,
        groep: GROEPEN.includes(groep) ? groep : "divers",
        actief: formData.get("actief") === "on",
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/categorieen");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function deleteCategorie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("categorie").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/categorieen");
    return { ok: true, message: "Categorie verwijderd." };
  });
}
