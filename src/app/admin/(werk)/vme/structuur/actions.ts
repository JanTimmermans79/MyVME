"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, optStr, type ActionState } from "@/lib/action-helpers";
import { UNIT_TYPES } from "@/lib/types";

/** Leeg -> null; anders een niet-negatief getal (komma of punt). */
function parseQuotiteit(formData: FormData): number | null | { error: string } {
  const raw = optStr(formData, "quotiteit");
  if (raw == null) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0)
    return { error: "Quotiteit moet een positief getal zijn." };
  return n;
}

function parseType(formData: FormData): string {
  const t = str(formData, "type");
  return (UNIT_TYPES as readonly string[]).includes(t) ? t : "appartement";
}

const MIGRATIE = "supabase/migrations/20261120100000_structuur_archief.sql";
const kolomOntbreekt = (msg: string) => /\btype\b/.test(msg) && /column|schema cache/i.test(msg);

function revalidate() {
  revalidatePath("/admin/vme/structuur");
  revalidatePath("/admin/vme/eigenaars");
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
    const type = parseType(formData);

    let { error } = await db.from("unit").insert({ vme_id, naam, quotiteit, type });
    if (error && kolomOntbreekt(error.message)) {
      // Migratie nog niet uitgevoerd: zonder type opslaan (alleen appartementen).
      if (type !== "appartement")
        return {
          ok: false,
          error: `Het soort kavel kan pas opgeslagen worden nadat de migratie ${MIGRATIE} is uitgevoerd.`,
        };
      ({ error } = await db.from("unit").insert({ vme_id, naam, quotiteit }));
    }
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, message: "Toegevoegd." };
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
    const type = parseType(formData);

    let { error } = await db
      .from("unit")
      .update({ naam, quotiteit, type })
      .eq("id", id);
    if (error && kolomOntbreekt(error.message)) {
      if (type !== "appartement")
        return {
          ok: false,
          error: `Het soort kavel kan pas opgeslagen worden nadat de migratie ${MIGRATIE} is uitgevoerd.`,
        };
      ({ error } = await db.from("unit").update({ naam, quotiteit }).eq("id", id));
    }
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
      return {
        ok: false,
        error:
          "Er zijn (ook gearchiveerde) eigenaars aan dit kavel gekoppeld. Verwijder die koppeling eerst.",
      };

    const { error } = await db.from("unit").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, message: "Verwijderd." };
  });
}
