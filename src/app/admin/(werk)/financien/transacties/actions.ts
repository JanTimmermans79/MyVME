"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";

/** Soorten zonder kost. */
const SOORTEN = new Set([
  "voorschot",
  "afrekening",
  "interne_overboeking",
  "rente",
  "kapitaalsoproep",
  "terugbetaling",
  "overig",
]);

const HUURDER_RUBRIEKEN = new Set(["elektriciteit", "schoonmaak", "onderhoud", "diverse"]);
const VERBRUIK_RUBRIEKEN = new Set([
  "koud water",
  "warm water",
  "centrale verwarming",
  "mazout",
]);

/**
 * Duidt per bankverrichting aan wat het is. Keuzes:
 *  - voorschot, afrekening, interne_overboeking, rente, kapitaalsoproep,
 *    terugbetaling, overig
 *  - kost:huurders:<rubriek>   → betaling leverancier, kost aan de huurders
 *  - kost:eigenaars:<rubriek>  → betaling leverancier, kost aan de eigenaars
 *  - kost:verbruik:<rubriek>   → betaling leverancier, via de tellers verdeeld
 * Voor een kost wordt de bijhorende kostenboeking (Kosten-menu) aangemaakt of
 * bijgewerkt; kiest iemand een andere soort, dan verdwijnt die boeking weer.
 */
export async function classificeerTransactie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const keuze = str(formData, "keuze");
    if (!id || !keuze) return { ok: false, error: "Ontbrekende gegevens." };

    const { data: tx } = await db
      .from("transactie")
      .select("id, vme_id, datum, bedrag, tegenpartij_naam, mededeling, rekening, boekjaar_id")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        vme_id: string;
        datum: string;
        bedrag: number;
        tegenpartij_naam: string | null;
        mededeling: string | null;
        rekening: "zicht" | "spaar" | null;
        boekjaar_id: string | null;
      }>();
    if (!tx) return { ok: false, error: "Transactie niet gevonden." };

    // --- geen kost: soort aanpassen en een eventuele kostenboeking weghalen
    if (SOORTEN.has(keuze)) {
      const { error } = await db.from("transactie").update({ soort: keuze }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      await db.from("kosten").delete().eq("betaald_met_transactie_id", id);
      revalideer();
      return { ok: true, message: "Soort aangepast." };
    }

    // --- kost
    const [, wie, rubriek] = keuze.split(":");
    if (keuze.split(":")[0] !== "kost" || !wie || !rubriek)
      return { ok: false, error: "Onbekende keuze." };

    let verdeling: string;
    if (wie === "huurders" && HUURDER_RUBRIEKEN.has(rubriek)) verdeling = "gelijk_huurders";
    else if (wie === "eigenaars") verdeling = "gelijk_eigenaars";
    else if (wie === "verbruik" && VERBRUIK_RUBRIEKEN.has(rubriek))
      // Een terugbetaling (inkomend) kan niet via de tellers verrekend worden.
      verdeling = Number(tx.bedrag) > 0 ? "gelijk_huurders" : "individueel_verbruik";
    else return { ok: false, error: "Ongeldige rubriek." };
    const betaler_type = verdeling === "gelijk_eigenaars" ? "eigenaar" : "huurder";

    // Boekjaar: expliciet op de transactie, anders volgens de datum.
    let boekjaarId = tx.boekjaar_id;
    if (!boekjaarId) {
      const { data: bj } = await db
        .from("boekjaar")
        .select("id")
        .eq("vme_id", tx.vme_id)
        .lte("start_datum", tx.datum)
        .gte("eind_datum", tx.datum)
        .limit(1)
        .maybeSingle<{ id: string }>();
      boekjaarId = bj?.id ?? null;
    }
    if (!boekjaarId)
      return { ok: false, error: "Er bestaat geen boekjaar voor de datum van deze verrichting." };

    const rij = {
      vme_id: tx.vme_id,
      boekjaar_id: boekjaarId,
      categorie: rubriek,
      rekening: tx.rekening ?? "zicht",
      bedrag: -Number(tx.bedrag), // uitgaand (-) = kost (+); inkomend = krediet
      datum: tx.datum,
      leverancier: tx.tegenpartij_naam,
      omschrijving: tx.mededeling,
      verdeling,
      betaler_type,
      status: "bevestigd",
      bron: "manueel",
      betaald_met_transactie_id: id,
    };

    const { data: bestaand } = await db
      .from("kosten")
      .select("id")
      .eq("betaald_met_transactie_id", id)
      .limit(1)
      .maybeSingle<{ id: string }>();
    const { error: kostFout } = bestaand
      ? await db.from("kosten").update(rij).eq("id", bestaand.id)
      : await db.from("kosten").insert(rij);
    if (kostFout) return { ok: false, error: kostFout.message };

    const { error } = await db.from("transactie").update({ soort: "kost" }).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalideer();
    return { ok: true, message: "Kost geboekt." };
  });
}

function revalideer() {
  revalidatePath("/admin/financien", "layout");
  revalidatePath("/admin/kosten", "layout");
  revalidatePath("/admin/afrekeningen");
  revalidatePath("/admin/dashboard");
}
