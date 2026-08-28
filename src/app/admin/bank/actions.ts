"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";
import { autoMatch, type Kandidaat } from "@/lib/bank-matching";
import type { ParsedTx } from "@/lib/bank-parse";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

async function eigenaarKandidaten(db: Db, vmeId: string): Promise<Kandidaat[]> {
  const { data: units } = await db
    .from("unit")
    .select("id")
    .eq("vme_id", vmeId);
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (unitIds.length === 0) return [];

  const { data } = await db
    .from("eigenaar")
    .select("unit_id, naam, structuurcode_prefix")
    .in("unit_id", unitIds);

  return (data ?? []).map(
    (e: {
      unit_id: string;
      naam: string;
      structuurcode_prefix: string | null;
    }) => ({
      unit_id: e.unit_id,
      naam: e.naam,
      structuurcode_prefix: e.structuurcode_prefix,
      betaler_type: "eigenaar" as const,
    }),
  );
}

export async function importTransacties(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    if (!vme_id) return { ok: false, error: "Geen VME." };

    let rows: ParsedTx[];
    try {
      rows = JSON.parse(str(formData, "rows")) as ParsedTx[];
    } catch {
      return { ok: false, error: "Kon de ingelezen data niet verwerken." };
    }
    if (!Array.isArray(rows) || rows.length === 0)
      return { ok: false, error: "Geen transacties om te importeren." };

    // Dedupe tegen wat er al in de DB zit.
    const hashes = rows.map((r) => r.import_hash);
    const { data: bestaande } = await db
      .from("transactie")
      .select("import_hash")
      .eq("vme_id", vme_id)
      .in("import_hash", hashes);
    const bekend = new Set(
      (bestaande ?? []).map((b: { import_hash: string }) => b.import_hash),
    );

    const kandidaten = await eigenaarKandidaten(db, vme_id);

    const nieuw = rows
      .filter((r) => !bekend.has(r.import_hash))
      // ontdubbel ook binnen het bestand zelf
      .filter(
        (r, i, arr) =>
          arr.findIndex((x) => x.import_hash === r.import_hash) === i,
      )
      .map((r) => {
        const m = autoMatch(r.mededeling, kandidaten);
        return {
          vme_id,
          datum: r.datum,
          bedrag: r.bedrag,
          tegenpartij_naam: r.tegenpartij_naam,
          mededeling: r.mededeling,
          bron: "xls" as const,
          import_hash: r.import_hash,
          gematchte_unit_id: m.gematchte_unit_id,
          betaler_type: m.betaler_type,
          match_type: m.match_type,
        };
      });

    if (nieuw.length === 0)
      return {
        ok: true,
        message: `Niets nieuw: alle ${rows.length} transacties bestonden al.`,
      };

    const { error } = await db.from("transactie").insert(nieuw);
    if (error) return { ok: false, error: error.message };

    const auto = nieuw.filter((n) => n.match_type === "automatisch").length;
    revalidatePath("/admin/bank");
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: `${nieuw.length} transactie(s) geïmporteerd, waarvan ${auto} automatisch gematcht. ${
        rows.length - nieuw.length
      } duplica(a)t(en) overgeslagen.`,
    };
  });
}

export async function assignTransactie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const unit_id = str(formData, "unit_id");
    const betaler_type = str(formData, "betaler_type");
    if (!id || !unit_id || !["eigenaar", "huurder"].includes(betaler_type))
      return { ok: false, error: "Kies een unit en een betaler." };

    const { error } = await db
      .from("transactie")
      .update({
        gematchte_unit_id: unit_id,
        betaler_type,
        match_type: "manueel",
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bank");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Transactie toegewezen." };
  });
}

export async function ontkoppelTransactie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db
      .from("transactie")
      .update({
        gematchte_unit_id: null,
        betaler_type: null,
        match_type: "onbevestigd",
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bank");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Toewijzing ongedaan gemaakt." };
  });
}

export async function deleteTransactie(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("transactie").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bank");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Transactie verwijderd." };
  });
}
