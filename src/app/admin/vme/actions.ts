"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";

type VmeFields = {
  naam: string;
  adres: string | null;
  iban: string | null;
  iban_reserve: string | null;
  aantal_kavels: number | null;
};

function parseVme(formData: FormData): VmeFields | { error: string } {
  const naam = str(formData, "naam");
  if (!naam) return { error: "Naam is verplicht." };

  const aantalRaw = str(formData, "aantal_kavels");
  let aantal_kavels: number | null = null;
  if (aantalRaw) {
    const n = Number.parseInt(aantalRaw, 10);
    if (!Number.isFinite(n) || n < 0)
      return { error: "Aantal appartementen moet een positief geheel getal zijn." };
    aantal_kavels = n;
  }

  return {
    naam,
    adres: optStr(formData, "adres"),
    iban: optStr(formData, "iban"),
    iban_reserve: optStr(formData, "iban_reserve"),
    aantal_kavels,
  };
}

export async function createVme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const fields = parseVme(formData);
    if ("error" in fields) return { ok: false, error: fields.error };

    const { error } = await db.from("vme").insert(fields);
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
    if (!id) return { ok: false, error: "Geen VME." };
    const fields = parseVme(formData);
    if ("error" in fields) return { ok: false, error: fields.error };

    const { error } = await db.from("vme").update(fields).eq("id", id);
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
