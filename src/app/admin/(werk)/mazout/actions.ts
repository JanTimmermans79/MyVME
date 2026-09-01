"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  num,
  type ActionState,
} from "@/lib/action-helpers";

export async function createMazout(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const datum = str(formData, "datum");
    if (!vme_id || !datum)
      return { ok: false, error: "Datum, liter en prijs zijn verplicht." };

    const liter = num(formData, "liter");
    if (liter <= 0) return { ok: false, error: "Aantal liter moet groter dan 0 zijn." };

    // Je mag ofwel de prijs per liter ingeven, ofwel het totale factuurbedrag.
    // Ontbreekt de prijs, dan leiden we die af uit het bedrag (en omgekeerd).
    const bedragInput = num(formData, "bedrag");
    let prijs_per_liter = num(formData, "prijs_per_liter");
    let bedrag: number | null = bedragInput > 0 ? bedragInput : null;
    if (prijs_per_liter <= 0 && bedrag != null) {
      prijs_per_liter = Math.round((bedrag / liter) * 10000) / 10000;
    } else if (bedrag == null && prijs_per_liter > 0) {
      bedrag = Math.round(prijs_per_liter * liter * 100) / 100;
    }
    if (prijs_per_liter <= 0)
      return {
        ok: false,
        error: "Geef een prijs per liter of een totaal factuurbedrag in.",
      };

    const { error } = await db.from("mazout_levering").insert({
      vme_id,
      datum,
      liter,
      prijs_per_liter,
      bedrag,
      leverancier: optStr(formData, "leverancier"),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/mazout");
    return { ok: true, message: "Levering geregistreerd." };
  });
}

export async function deleteMazout(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("mazout_levering").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/mazout");
    return { ok: true, message: "Levering verwijderd." };
  });
}
