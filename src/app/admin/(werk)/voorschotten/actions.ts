"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, num, type ActionState } from "@/lib/action-helpers";

export async function setVoorschotEigenaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const unit_id = str(formData, "unit_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    if (!unit_id || !boekjaar_id)
      return { ok: false, error: "Unit en boekjaar zijn verplicht." };

    const raw = str(formData, "bedrag_per_maand");
    if (raw === "") {
      await db
        .from("voorschot_eigenaar")
        .delete()
        .eq("unit_id", unit_id)
        .eq("boekjaar_id", boekjaar_id);
      revalidatePath("/admin/voorschotten");
      return { ok: true, message: "Voorschot gewist." };
    }

    const bedrag_per_maand = num(formData, "bedrag_per_maand");
    if (bedrag_per_maand < 0)
      return { ok: false, error: "Bedrag mag niet negatief zijn." };

    const { error } = await db
      .from("voorschot_eigenaar")
      .upsert(
        { unit_id, boekjaar_id, bedrag_per_maand },
        { onConflict: "unit_id,boekjaar_id" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/voorschotten");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function setVoorschotHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const huurder_id = str(formData, "huurder_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    if (!huurder_id || !boekjaar_id)
      return { ok: false, error: "Huurder en boekjaar zijn verplicht." };

    const raw = str(formData, "bedrag_per_maand");
    if (raw === "") {
      await db
        .from("voorschot_huurder")
        .delete()
        .eq("huurder_id", huurder_id)
        .eq("boekjaar_id", boekjaar_id);
      revalidatePath("/admin/voorschotten");
      return { ok: true, message: "Voorschot gewist." };
    }

    const bedrag_per_maand = num(formData, "bedrag_per_maand");
    if (bedrag_per_maand < 0)
      return { ok: false, error: "Bedrag mag niet negatief zijn." };

    const { error } = await db
      .from("voorschot_huurder")
      .upsert(
        { huurder_id, boekjaar_id, bedrag_per_maand },
        { onConflict: "huurder_id,boekjaar_id" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/voorschotten");
    return { ok: true, message: "Opgeslagen." };
  });
}
