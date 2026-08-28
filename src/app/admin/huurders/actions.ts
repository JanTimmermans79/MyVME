"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";

function huurderPayload(formData: FormData) {
  return {
    naam: str(formData, "naam"),
    voornaam: optStr(formData, "voornaam"),
    email: optStr(formData, "email"),
    telefoon: optStr(formData, "telefoon"),
    iban: optStr(formData, "iban"),
    ingang_datum: optStr(formData, "ingang_datum"),
    uitgang_datum: optStr(formData, "uitgang_datum"),
  };
}

export async function createHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const unit_id = str(formData, "unit_id");
    const p = huurderPayload(formData);
    if (!unit_id || !p.naam)
      return { ok: false, error: "Unit en naam zijn verplicht." };

    const { error } = await db.from("huurder").insert({ unit_id, ...p });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/huurders");
    return { ok: true, message: "Huurder toegevoegd." };
  });
}

export async function updateHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const p = huurderPayload(formData);
    if (!id || !p.naam) return { ok: false, error: "Naam is verplicht." };

    const { error } = await db.from("huurder").update(p).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/huurders");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function deleteHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen huurder." };
    const { error } = await db.from("huurder").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/huurders");
    return { ok: true, message: "Huurder verwijderd." };
  });
}
