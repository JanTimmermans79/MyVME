"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, num, type ActionState } from "@/lib/action-helpers";

export async function createVoorschot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const unit_id = str(formData, "unit_id");
    const betaler_type = str(formData, "betaler_type");
    const ingang_datum = str(formData, "ingang_datum");
    if (!unit_id || !["eigenaar", "huurder"].includes(betaler_type) || !ingang_datum)
      return { ok: false, error: "Unit, type en ingangsdatum zijn verplicht." };

    const bedrag_per_maand = num(formData, "bedrag_per_maand");
    if (bedrag_per_maand < 0)
      return { ok: false, error: "Bedrag mag niet negatief zijn." };

    const { error } = await db.from("voorschot").insert({
      unit_id,
      betaler_type,
      bedrag_per_maand,
      ingang_datum,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/voorschotten");
    return { ok: true, message: "Voorschot toegevoegd." };
  });
}

export async function deleteVoorschot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("voorschot").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/voorschotten");
    return { ok: true, message: "Voorschot verwijderd." };
  });
}
