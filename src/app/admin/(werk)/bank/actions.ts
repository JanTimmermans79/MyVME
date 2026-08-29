"use server";

import { revalidatePath } from "next/cache";
import { runAdmin, str, type ActionState } from "@/lib/action-helpers";
import { requireAdmin } from "@/lib/auth";
import type { ParsedTx } from "@/lib/bank-parse";
import {
  classificeer,
  type ClassifyContext,
} from "@/lib/bank-classify";
import { parseKbcPdf } from "@/lib/kbc-pdf";
import type { VmeRekening } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

async function classifyContext(
  db: Db,
  vmeId: string,
  rekening: VmeRekening | null,
): Promise<ClassifyContext> {
  const { data: vme } = await db
    .from("vme")
    .select("iban, iban_reserve")
    .eq("id", vmeId)
    .maybeSingle<{ iban: string | null; iban_reserve: string | null }>();

  const { data: units } = await db.from("unit").select("id").eq("vme_id", vmeId);
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);

  const [{ data: eigenaars }, { data: huurders }, { data: relaties }] =
    await Promise.all([
      unitIds.length
        ? db.from("eigenaar").select("unit_id, iban").in("unit_id", unitIds)
        : Promise.resolve({ data: [] }),
      unitIds.length
        ? db.from("huurder").select("unit_id, iban").in("unit_id", unitIds)
        : Promise.resolve({ data: [] }),
      db
        .from("bankrelatie")
        .select("iban, type, mandaatreferte")
        .eq("vme_id", vmeId),
    ]);

  return {
    rekening,
    vmeZichtIban: vme?.iban ?? null,
    vmeSpaarIban: vme?.iban_reserve ?? null,
    owners: (eigenaars ?? []) as { unit_id: string; iban: string | null }[],
    occupants: (huurders ?? []) as { unit_id: string; iban: string | null }[],
    bankrelaties: (relaties ?? []) as {
      iban: string;
      type: string;
      mandaatreferte: string | null;
    }[],
  };
}

/** Server action: leest een KBC-PDF en geeft de herkende verrichtingen terug. */
export async function parsePdfBankexport(
  _prev: ActionState & { data?: unknown },
  formData: FormData,
): Promise<ActionState & { data?: unknown }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Geen toegang." };
  }

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Geen PDF ontvangen." };
  if (file.size > 8_000_000)
    return { ok: false, error: "PDF te groot (max 8 MB)." };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const res = await parseKbcPdf(buffer);
    if (res.txns.length === 0)
      return {
        ok: false,
        error: res.fouten[0] ?? "Geen verrichtingen gevonden.",
      };

    const som = res.txns.reduce((s, t) => s + t.bedrag, 0);
    const klopt =
      res.saldo_begin != null &&
      res.saldo_eind != null &&
      Math.abs(res.saldo_begin + som - res.saldo_eind) < 0.02;

    return {
      ok: true,
      message: klopt
        ? "Uittreksel gelezen, saldo klopt."
        : "Uittreksel gelezen (saldo niet gecontroleerd).",
      data: res,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        "Kon de PDF niet lezen: " +
        (err instanceof Error ? err.message : "onbekende fout"),
    };
  }
}

interface ImportRow extends ParsedTx {
  mandaatreferte?: string | null;
}

export async function importTransacties(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    if (!vme_id) return { ok: false, error: "Geen VME." };

    const bron = str(formData, "bron") === "pdf" ? "pdf" : "xls";
    const rekeningRaw = str(formData, "rekening");
    const rekening: VmeRekening | null =
      rekeningRaw === "zicht" || rekeningRaw === "spaar" ? rekeningRaw : null;

    let rows: ImportRow[];
    try {
      rows = JSON.parse(str(formData, "rows")) as ImportRow[];
    } catch {
      return { ok: false, error: "Kon de ingelezen data niet verwerken." };
    }
    if (!Array.isArray(rows) || rows.length === 0)
      return { ok: false, error: "Geen transacties om te importeren." };

    const hashes = rows.map((r) => r.import_hash);
    const { data: bestaande } = await db
      .from("transactie")
      .select("import_hash")
      .eq("vme_id", vme_id)
      .in("import_hash", hashes);
    const bekend = new Set(
      (bestaande ?? []).map((b: { import_hash: string }) => b.import_hash),
    );

    const ctx = await classifyContext(db, vme_id, rekening);

    const nieuw = rows
      .filter((r) => !bekend.has(r.import_hash))
      .filter(
        (r, i, arr) =>
          arr.findIndex((x) => x.import_hash === r.import_hash) === i,
      )
      .map((r) => {
        const c = classificeer(
          {
            bedrag: r.bedrag,
            tegenpartij_naam: r.tegenpartij_naam,
            tegenpartij_iban: r.tegenpartij_iban,
            mededeling: r.mededeling,
            mandaatreferte: r.mandaatreferte ?? null,
          },
          ctx,
        );
        return {
          vme_id,
          datum: r.datum,
          bedrag: r.bedrag,
          tegenpartij_naam: r.tegenpartij_naam,
          tegenpartij_iban: r.tegenpartij_iban,
          mededeling: r.mededeling,
          bron,
          rekening,
          soort: c.soort,
          import_hash: r.import_hash,
          gematchte_unit_id: c.gematchte_unit_id,
          betaler_type: c.betaler_type,
          match_type: c.match_type,
        };
      });

    if (nieuw.length === 0)
      return {
        ok: true,
        message: `Niets nieuw: alle ${rows.length} verrichtingen bestonden al.`,
      };

    const { error } = await db.from("transactie").insert(nieuw);
    if (error) return { ok: false, error: error.message };

    // Uittreksel-metadata bewaren (periode + saldo) voor het dashboard.
    const periode_van = str(formData, "periode_van");
    const periode_tot = str(formData, "periode_tot");
    if (rekening && periode_van && periode_tot) {
      const saldoBeginRaw = str(formData, "saldo_begin");
      const saldoEindRaw = str(formData, "saldo_eind");
      const bestandsnaam = str(formData, "bestandsnaam") || null;

      const { data: bestaat } = await db
        .from("bankuittreksel")
        .select("id")
        .eq("vme_id", vme_id)
        .eq("rekening", rekening)
        .eq("periode_van", periode_van)
        .eq("periode_tot", periode_tot)
        .maybeSingle();

      if (!bestaat) {
        await db.from("bankuittreksel").insert({
          vme_id,
          rekening,
          bron,
          periode_van,
          periode_tot,
          saldo_begin: saldoBeginRaw ? Number(saldoBeginRaw) : null,
          saldo_eind: saldoEindRaw ? Number(saldoEindRaw) : null,
          aantal_verrichtingen: rows.length,
          bestandsnaam,
        });
      }
    }

    const auto = nieuw.filter((n) => n.match_type === "automatisch").length;
    const teControleren = nieuw.filter(
      (n) => n.match_type === "onbevestigd",
    ).length;
    revalidatePath("/admin/bank");
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: `${nieuw.length} verrichting(en) geïmporteerd — ${auto} automatisch, ${teControleren} te controleren. ${
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
    const soort = str(formData, "soort");
    if (!id || !unit_id || !["eigenaar", "huurder"].includes(betaler_type))
      return { ok: false, error: "Kies een unit en een betaler." };

    const patch: Record<string, unknown> = {
      gematchte_unit_id: unit_id,
      betaler_type,
      match_type: "manueel",
    };
    if (soort) patch.soort = soort;

    const { error } = await db.from("transactie").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bank");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Verrichting toegewezen." };
  });
}

export async function setTransactieSoort(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const soort = str(formData, "soort");
    if (!id || !soort) return { ok: false, error: "Ontbrekende gegevens." };
    const { error } = await db
      .from("transactie")
      .update({ soort })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bank");
    return { ok: true, message: "Soort aangepast." };
  });
}

/** Koppelt een transactie expliciet aan een boekjaar (leeg = terug naar datum). */
export async function setTransactieBoekjaar(id: string, boekjaarId: string) {
  await runAdmin(async (db) => {
    if (!id) return { ok: false, error: "Geen transactie." };
    const { error } = await db
      .from("transactie")
      .update({ boekjaar_id: boekjaarId || null })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bank");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Boekjaar aangepast." };
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
    return { ok: true, message: "Verrichting verwijderd." };
  });
}
