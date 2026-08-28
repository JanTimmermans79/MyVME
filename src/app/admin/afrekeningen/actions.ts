"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";
import { berekenAfrekening } from "@/lib/afrekening";
import { berekenHuurderAfrekeningen } from "@/lib/huurder-afrekening";

export async function berekenEnBewaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const boekjaar_id = str(formData, "boekjaar_id");
    if (!boekjaar_id) return { ok: false, error: "Kies een boekjaar." };

    const eig = await berekenAfrekening(db, boekjaar_id);
    const huur = await berekenHuurderAfrekeningen(db, boekjaar_id);

    // Bestaande, nog niet verzonden afrekeningen (+ hun lijnen) vervangen.
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

    // --- Eigenaars ---
    const eigRows = eig.regels.map((r) => ({
      boekjaar_id,
      unit_id: r.unit_id,
      huurder_id: null,
      betaler_type: "eigenaar" as const,
      verschuldigd: r.verschuldigd,
      ontvangen: r.ontvangen,
      saldo: r.saldo,
    }));
    if (eigRows.length) {
      const { error } = await db
        .from("afrekening")
        .upsert(eigRows, {
          onConflict: "boekjaar_id,unit_id,betaler_type,huurder_id",
        });
      if (error) return { ok: false, error: `eigenaars: ${error.message}` };
    }

    // --- Huurders (met detailregels) ---
    let huurderCount = 0;
    const waarschuwingen: string[] = [];
    for (const h of huur) {
      if (!h.actief) continue;
      huurderCount += 1;
      const { data: afr, error } = await db
        .from("afrekening")
        .upsert(
          {
            boekjaar_id,
            unit_id: h.unit_id,
            huurder_id: h.huurder_id,
            betaler_type: "huurder" as const,
            verschuldigd: h.totaal_kosten,
            ontvangen: h.voorschot_ontvangen,
            saldo: h.saldo,
          },
          { onConflict: "boekjaar_id,unit_id,betaler_type,huurder_id" },
        )
        .select("id")
        .single();
      if (error) return { ok: false, error: `huurders: ${error.message}` };

      await db.from("afrekening_lijn").delete().eq("afrekening_id", afr.id);
      await db.from("afrekening_lijn").insert(
        h.lijnen.map((l) => ({ afrekening_id: afr.id, ...l })),
      );
      for (const w of h.waarschuwingen)
        waarschuwingen.push(`${h.huurder_naam}: ${w}`);
    }

    revalidatePath("/admin/afrekeningen");

    let msg = `${eigRows.length} eigenaar- en ${huurderCount} huurderafrekening(en) berekend.`;
    if (eig.kostenZonderSleutel > 0)
      msg += ` ${eig.kostenZonderSleutel.toFixed(2)} EUR eigenaarskosten zonder verdeelsleutel niet verdeeld.`;
    if (waarschuwingen.length)
      msg += ` ${waarschuwingen.length} waarschuwing(en) — zie het overzicht.`;
    return { ok: true, message: msg };
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
        mail_verzonden_op:
          status === "verzonden" ? new Date().toISOString() : null,
        mail_status: status,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/afrekeningen");
    return { ok: true };
  });
}
