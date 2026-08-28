"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";

export async function createVme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const naam = str(formData, "naam");
    if (!naam) return { ok: false, error: "Naam is verplicht." };

    const { error } = await db.from("vme").insert({
      naam,
      adres: optStr(formData, "adres"),
      iban: optStr(formData, "iban"),
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/vme");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "VME aangemaakt." };
  });
}

export async function updateVme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const naam = str(formData, "naam");
    if (!id || !naam)
      return { ok: false, error: "Naam is verplicht." };

    const { error } = await db
      .from("vme")
      .update({
        naam,
        adres: optStr(formData, "adres"),
        iban: optStr(formData, "iban"),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/vme");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function deleteVme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen VME." };

    const { count } = await db
      .from("unit")
      .select("id", { count: "exact", head: true })
      .eq("vme_id", id);
    if ((count ?? 0) > 0)
      return {
        ok: false,
        error: "Verwijder eerst alle units van deze VME.",
      };

    const { error } = await db.from("vme").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/vme");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "VME verwijderd." };
  });
}
