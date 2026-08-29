"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";

function revalidate() {
  revalidatePath("/admin/units");
  revalidatePath("/admin/verdeelsleutels", "layout");
  revalidatePath("/admin", "layout");
}

export async function createUnit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const naam = str(formData, "naam");
    if (!vme_id || !naam) return { ok: false, error: "Naam is verplicht." };

    const { error } = await db.from("unit").insert({ vme_id, naam });
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, message: "Unit toegevoegd." };
  });
}

export async function renameUnit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const naam = str(formData, "naam");
    if (!id || !naam) return { ok: false, error: "Naam is verplicht." };
    const { error } = await db.from("unit").update({ naam }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function deleteUnit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { count } = await db
      .from("eigenaar")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", id);
    if ((count ?? 0) > 0)
      return { ok: false, error: "Ontkoppel eerst de eigenaar(s)." };

    const { error } = await db.from("unit").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, message: "Unit verwijderd." };
  });
}
