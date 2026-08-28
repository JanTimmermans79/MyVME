"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";

export async function createVerdeelsleutel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const naam = str(formData, "naam");
    if (!vme_id || !naam) return { ok: false, error: "Naam is verplicht." };

    const { error } = await db.from("verdeelsleutel").insert({
      vme_id,
      naam,
      type: optStr(formData, "type"),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/verdeelsleutels");
    return { ok: true, message: "Verdeelsleutel aangemaakt." };
  });
}

export async function updateVerdeelsleutel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const naam = str(formData, "naam");
    if (!id || !naam) return { ok: false, error: "Naam is verplicht." };

    const { error } = await db
      .from("verdeelsleutel")
      .update({ naam, type: optStr(formData, "type") })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/verdeelsleutels/${id}`);
    revalidatePath("/admin/verdeelsleutels");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function deleteVerdeelsleutel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { count } = await db
      .from("kosten")
      .select("id", { count: "exact", head: true })
      .eq("verdeelsleutel_id", id);
    if ((count ?? 0) > 0)
      return {
        ok: false,
        error: "Deze sleutel is nog aan kosten gekoppeld.",
      };

    const { error } = await db.from("verdeelsleutel").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/verdeelsleutels");
    return { ok: true, message: "Verdeelsleutel verwijderd." };
  });
}

/**
 * Slaat de aandelen op. Verwacht velden aandeel_<unitId>.
 * Lege waarde => rij verwijderd. Getal (>= 0) => rij ge-upsert.
 */
export async function saveAandelen(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const verdeelsleutel_id = str(formData, "verdeelsleutel_id");
    if (!verdeelsleutel_id) return { ok: false, error: "Geen sleutel." };

    const toUpsert: {
      verdeelsleutel_id: string;
      unit_id: string;
      aandeel: number;
    }[] = [];
    const toDelete: string[] = [];

    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("aandeel_")) continue;
      const unit_id = key.slice("aandeel_".length);
      const raw = String(value).trim().replace(",", ".");
      if (raw === "") {
        toDelete.push(unit_id);
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0)
        return { ok: false, error: `Ongeldig aandeel voor unit.` };
      toUpsert.push({ verdeelsleutel_id, unit_id, aandeel: n });
    }

    if (toUpsert.length) {
      const { error } = await db
        .from("verdeelsleutel_aandeel")
        .upsert(toUpsert, { onConflict: "verdeelsleutel_id,unit_id" });
      if (error) return { ok: false, error: error.message };
    }
    if (toDelete.length) {
      const { error } = await db
        .from("verdeelsleutel_aandeel")
        .delete()
        .eq("verdeelsleutel_id", verdeelsleutel_id)
        .in("unit_id", toDelete);
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath(`/admin/verdeelsleutels/${verdeelsleutel_id}`);
    return { ok: true, message: "Aandelen opgeslagen." };
  });
}
