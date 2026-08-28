"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";
import { normIban } from "@/lib/bank-parse";

function payload(formData: FormData) {
  const type = str(formData, "type");
  const betaler = str(formData, "standaard_betaler_type");
  return {
    naam: str(formData, "naam"),
    iban: normIban(str(formData, "iban")),
    type: ["leverancier", "eigen_rekening", "overig"].includes(type)
      ? type
      : "overig",
    standaard_categorie: optStr(formData, "standaard_categorie"),
    standaard_verdeelsleutel_id: optStr(formData, "standaard_verdeelsleutel_id"),
    standaard_betaler_type:
      betaler === "eigenaar" || betaler === "huurder" ? betaler : null,
  };
}

export async function createBankrelatie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const p = payload(formData);
    if (!vme_id || !p.naam || !p.iban)
      return { ok: false, error: "Naam en een geldige IBAN zijn verplicht." };

    const { error } = await db.from("bankrelatie").insert({ vme_id, ...p });
    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Deze IBAN is al geconfigureerd voor deze VME." };
      return { ok: false, error: error.message };
    }
    revalidatePath("/admin/bankrelaties");
    return { ok: true, message: "Bankrelatie toegevoegd." };
  });
}

export async function updateBankrelatie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const p = payload(formData);
    if (!id || !p.naam || !p.iban)
      return { ok: false, error: "Naam en een geldige IBAN zijn verplicht." };

    const { error } = await db.from("bankrelatie").update(p).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bankrelaties");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function deleteBankrelatie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen bankrelatie." };
    const { error } = await db.from("bankrelatie").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bankrelaties");
    return { ok: true, message: "Verwijderd." };
  });
}
