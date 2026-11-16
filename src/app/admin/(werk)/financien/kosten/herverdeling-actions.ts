"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, optStr, num, type ActionState } from "@/lib/action-helpers";
import { wisHerverdeling, zetHerverdeling } from "@/lib/herverdeling";

function ververs() {
  revalidatePath("/admin/financien");
  revalidatePath("/admin", "layout");
}

/**
 * Past een besluit van de algemene vergadering toe: `bedrag` (extra verbruikskost)
 * wordt voor `pct_huurders` % gelijk over de huurders en voor de rest gelijk over
 * de eigenaars verdeeld. Een eerdere herverdeling van dezelfde categorie wordt
 * vervangen — het besluit kan dus gewoon opnieuw ingevoerd worden.
 */
export async function pasHerverdelingToe(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    const categorie = str(formData, "categorie");
    if (!vme_id || !boekjaar_id || !categorie)
      return { ok: false, error: "VME, boekjaar en categorie zijn verplicht." };

    const res = await zetHerverdeling(db, {
      vme_id,
      boekjaar_id,
      categorie,
      bedrag: num(formData, "bedrag"),
      pct_huurders: num(formData, "pct_huurders"),
      toelichting: optStr(formData, "toelichting") ?? "besluit algemene vergadering",
    });
    if ("error" in res) return { ok: false, error: res.error };

    ververs();
    return {
      ok: true,
      message: `Herverdeling toegepast: huurders ${res.huurders.toFixed(2)} €, eigenaars ${res.eigenaars.toFixed(2)} €. Herbereken de afrekening.`,
    };
  });
}

/** Maakt de herverdeling ongedaan: het extra bedrag valt terug op "individueel verbruik". */
export async function verwijderHerverdeling(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const boekjaar_id = str(formData, "boekjaar_id");
    const categorie = str(formData, "categorie");
    if (!boekjaar_id || !categorie)
      return { ok: false, error: "Boekjaar en categorie zijn verplicht." };
    const fout = await wisHerverdeling(db, boekjaar_id, categorie);
    if (fout) return { ok: false, error: fout.error };
    ververs();
    return { ok: true, message: "Herverdeling verwijderd. Herbereken de afrekening." };
  });
}
