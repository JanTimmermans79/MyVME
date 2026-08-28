"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";
import { berekenAfrekening } from "@/lib/afrekening";

export async function berekenEnBewaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const boekjaar_id = str(formData, "boekjaar_id");
    if (!boekjaar_id) return { ok: false, error: "Kies een boekjaar." };

    const resultaat = await berekenAfrekening(db, boekjaar_id);

    // Bestaande (nog niet verzonden) afrekeningen vervangen.
    const { data: bestaand } = await db
      .from("afrekening")
      .select("id, mail_verzonden_op")
      .eq("boekjaar_id", boekjaar_id);
    const verzonden = new Set(
      (bestaand ?? [])
        .filter((a: { mail_verzonden_op: string | null }) => a.mail_verzonden_op)
        .map((a: { id: string }) => a.id),
    );
    const teVerwijderen = (bestaand ?? [])
      .filter((a: { id: string }) => !verzonden.has(a.id))
      .map((a: { id: string }) => a.id);
    if (teVerwijderen.length) {
      await db.from("afrekening").delete().in("id", teVerwijderen);
    }

    const rows = resultaat.regels.map((r) => ({
      boekjaar_id,
      unit_id: r.unit_id,
      betaler_type: r.betaler_type,
      verschuldigd: r.verschuldigd,
      ontvangen: r.ontvangen,
      saldo: r.saldo,
    }));

    if (rows.length) {
      const { error } = await db
        .from("afrekening")
        .upsert(rows, { onConflict: "boekjaar_id,unit_id,betaler_type" });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/admin/afrekeningen");

    const waarschuwing =
      resultaat.kostenZonderSleutel > 0
        ? ` Let op: ${resultaat.kostenZonderSleutel.toFixed(
            2,
          )} EUR aan kosten heeft nog geen verdeelsleutel en is niet verdeeld.`
        : "";
    return {
      ok: true,
      message: `${rows.length} afrekening(en) berekend.${waarschuwing}`,
    };
  });
}

export async function recordMail(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "afrekening_id");
    const status = str(formData, "status") || "verzonden";
    if (!id) return { ok: false, error: "Geen afrekening." };

    const { error } = await db
      .from("afrekening")
      .update({
        mail_verzonden_op: status === "verzonden" ? new Date().toISOString() : null,
        mail_status: status,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/afrekeningen");
    return { ok: true };
  });
}
