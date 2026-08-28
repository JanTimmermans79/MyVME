"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { str, type ActionState } from "@/lib/action-helpers";
import {
  ACTIVE_VME_COOKIE,
  ACTIVE_BOEKJAAR_COOKIE,
} from "@/lib/vme-context";

const YEAR = 60 * 60 * 24 * 365;

export async function setActiveVme(formData: FormData) {
  await requireAdmin();
  const vmeId = String(formData.get("vme_id") ?? "");
  if (vmeId) {
    const c = await cookies();
    c.set(ACTIVE_VME_COOKIE, vmeId, { path: "/", maxAge: YEAR, sameSite: "lax" });
    c.delete(ACTIVE_BOEKJAAR_COOKIE); // boekjaar hoort bij de vorige VME
  }
  revalidatePath("/admin", "layout");
}

export async function setActiveBoekjaar(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("boekjaar_id") ?? "");
  if (id) {
    const c = await cookies();
    c.set(ACTIVE_BOEKJAAR_COOKIE, id, {
      path: "/",
      maxAge: YEAR,
      sameSite: "lax",
    });
  }
  revalidatePath("/admin", "layout");
}

/** Maakt een boekjaar aan en zet het meteen als actief. */
export async function nieuwBoekjaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Geen toegang." };
  }
  const vme_id = str(formData, "vme_id");
  const start_datum = str(formData, "start_datum");
  const eind_datum = str(formData, "eind_datum");
  if (!vme_id || !start_datum || !eind_datum)
    return { ok: false, error: "Vul begin- en einddatum in." };
  if (eind_datum <= start_datum)
    return { ok: false, error: "Einddatum moet na begindatum liggen." };

  const db = createAdminClient();
  const { data, error } = await db
    .from("boekjaar")
    .insert({ vme_id, start_datum, eind_datum })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const c = await cookies();
  c.set(ACTIVE_BOEKJAAR_COOKIE, data.id, {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Boekjaar aangemaakt en geselecteerd." };
}
