"use server";

import { revalidatePath } from "next/cache";
import {
  runUser,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";

export async function updateEigenContact(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runUser(async (db) => {
    const id = str(formData, "id");
    const naam = str(formData, "naam");
    if (!id || !naam) return { ok: false, error: "Naam is verplicht." };

    // RLS: eigenaar_update_own laat enkel het eigen record toe; unit_id /
    // auth_user_id / structuurcode_prefix zijn kolom-geweigerd.
    const { error } = await db
      .from("eigenaar")
      .update({
        naam,
        email: optStr(formData, "email"),
        telefoon: optStr(formData, "telefoon"),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/contact");
    revalidatePath("/dashboard");
    return { ok: true, message: "Contactgegevens opgeslagen." };
  });
}

export async function upsertHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runUser(async (db) => {
    const id = optStr(formData, "id");
    const unit_id = str(formData, "unit_id");
    const naam = str(formData, "naam");
    if (!unit_id || !naam)
      return { ok: false, error: "Unit en naam zijn verplicht." };

    const payload = {
      unit_id,
      naam,
      voornaam: optStr(formData, "voornaam"),
      email: optStr(formData, "email"),
      telefoon: optStr(formData, "telefoon"),
      iban: optStr(formData, "iban"),
      ingang_datum: optStr(formData, "ingang_datum"),
      uitgang_datum: optStr(formData, "uitgang_datum"),
    };

    // RLS (huurder_*_eigenaar) controleert dat unit_id een eigen unit is.
    const { error } = id
      ? await db.from("huurder").update(payload).eq("id", id)
      : await db.from("huurder").insert(payload);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/contact");
    return { ok: true, message: "Huurdergegevens opgeslagen." };
  });
}

export async function deleteHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runUser(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen huurder." };
    const { error } = await db.from("huurder").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/contact");
    return { ok: true, message: "Huurder verwijderd." };
  });
}
