"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, optStr, type ActionState } from "@/lib/action-helpers";

/** Leeg -> null; anders een niet-negatief getal (komma of punt). */
function parseQuotiteit(formData: FormData): number | null | { error: string } {
  const raw = optStr(formData, "quotiteit");
  if (raw == null) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0)
    return { error: "Quotiteit moet een positief getal zijn." };
  return n;
}

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
    const quotiteit = parseQuotiteit(formData);
    if (quotiteit && typeof quotiteit === "object") return { ok: false, ...quotiteit };

    const { error } = await db.from("unit").insert({ vme_id, naam, quotiteit });
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
    const quotiteit = parseQuotiteit(formData);
    if (quotiteit && typeof quotiteit === "object") return { ok: false, ...quotiteit };
    const { error } = await db
      .from("unit")
      .update({ naam, quotiteit })
      .eq("id", id);
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
