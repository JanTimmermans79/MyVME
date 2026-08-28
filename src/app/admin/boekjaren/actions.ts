"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";

export async function createBoekjaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const start_datum = str(formData, "start_datum");
    const eind_datum = str(formData, "eind_datum");
    if (!vme_id || !start_datum || !eind_datum)
      return { ok: false, error: "Vul begin- en einddatum in." };
    if (eind_datum <= start_datum)
      return { ok: false, error: "Einddatum moet na begindatum liggen." };

    const { error } = await db
      .from("boekjaar")
      .insert({ vme_id, start_datum, eind_datum });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/boekjaren");
    return { ok: true, message: "Boekjaar aangemaakt." };
  });
}

export async function setBoekjaarStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const status = str(formData, "status");
    if (!["open", "afgesloten"].includes(status))
      return { ok: false, error: "Ongeldige status." };

    const { error } = await db.from("boekjaar").update({ status }).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/boekjaren");
    return {
      ok: true,
      message: status === "afgesloten" ? "Boekjaar afgesloten." : "Boekjaar heropend.",
    };
  });
}

export async function deleteBoekjaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { count } = await db
      .from("kosten")
      .select("id", { count: "exact", head: true })
      .eq("boekjaar_id", id);
    if ((count ?? 0) > 0)
      return { ok: false, error: "Er hangen kosten aan dit boekjaar." };

    const { error } = await db.from("boekjaar").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/boekjaren");
    return { ok: true, message: "Boekjaar verwijderd." };
  });
}
