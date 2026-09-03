"use server";

import { revalidatePath } from "next/cache";
import {
  runUser,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadNaarDocumenten } from "@/lib/documenten-upload";
import { getActiveContext } from "@/lib/vme-context";

export async function updateEigenContact(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runUser(async (db) => {
    const id = str(formData, "id");
    const naam = str(formData, "naam");
    if (!id || !naam) return { ok: false, error: "Naam is verplicht." };

    // RLS: eigenaar_update_own laat enkel het eigen record toe; unit_id /
    // auth_user_id / structuurcode_prefix zijn kolom-geweigerd.
    const { error } = await db
      .from("eigenaar")
      .update({
        naam,
        email: optStr(formData, "email"),
        telefoon: optStr(formData, "telefoon"),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/contact");
    revalidatePath("/dashboard");
    return { ok: true, message: "Contactgegevens opgeslagen." };
  });
}

export async function upsertHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runUser(async (db) => {
    const id = optStr(formData, "id");
    const unit_id = str(formData, "unit_id");
    const naam = str(formData, "naam");
    if (!unit_id || !naam)
      return { ok: false, error: "Unit en naam zijn verplicht." };

    const payload = {
      unit_id,
      naam,
      voornaam: optStr(formData, "voornaam"),
      email: optStr(formData, "email"),
      telefoon: optStr(formData, "telefoon"),
      iban: optStr(formData, "iban"),
      ingang_datum: optStr(formData, "ingang_datum"),
      uitgang_datum: optStr(formData, "uitgang_datum"),
    };

    // RLS (huurder_*_eigenaar) controleert dat unit_id een eigen unit is.
    const { error } = id
      ? await db.from("huurder").update(payload).eq("id", id)
      : await db.from("huurder").insert(payload);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/contact");
    return { ok: true, message: "Huurdergegevens opgeslagen." };
  });
}

export async function deleteHuurder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runUser(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen huurder." };
    const { error } = await db.from("huurder").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/contact");
    return { ok: true, message: "Huurder verwijderd." };
  });
}

export type DienMeteropnameResultaat =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Een eigenaar dient een meterstand in voor zijn eigen appartement — via een
 * tellerfoto (met OCR-voorstel) óf handmatig (teller + datum + waarde, zonder
 * foto). De opname belandt als `meteropname` (rol 'eigenaar', status 'nieuw') in
 * de inbox van de syndicus en wordt pas een echte `meterstand` na diens
 * bevestiging.
 *
 * De storage-upload + `document`-rij vereisen de admin-client (bucket/tabel zijn
 * admin-only schrijfbaar); de eigendomscontrole gebeurt eerst met de RLS-client.
 */
export async function dienMeteropnameIn(
  formData: FormData,
): Promise<DienMeteropnameResultaat> {
  let userId: string;
  try {
    userId = (await requireUser()).userId;
  } catch {
    return { ok: false, error: "Niet ingelogd." };
  }
  try {
    const unit_id = str(formData, "unit_id");
    if (!unit_id) return { ok: false, error: "Geen appartement." };

    const fileRaw = formData.get("file");
    const file =
      fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
    if (file) {
      if (!file.type.startsWith("image/"))
        return { ok: false, error: "Enkel een foto (afbeelding) van de teller." };
      if (file.size > 8 * 1024 * 1024)
        return { ok: false, error: "De foto is groter dan 8 MB." };
    }

    const teller_id = optStr(formData, "teller_id");
    const opname_datum = optStr(formData, "opname_datum");
    const raw = optStr(formData, "herkende_waarde");
    const herkende_waarde =
      raw != null && Number.isFinite(Number(raw.replace(",", ".")))
        ? Number(raw.replace(",", "."))
        : null;

    // Handmatige opname (geen foto): teller, datum en waarde zijn verplicht.
    if (!file) {
      if (!teller_id || !opname_datum || herkende_waarde == null)
        return {
          ok: false,
          error: "Kies de teller en vul de datum en meterstand in.",
        };
      if (herkende_waarde < 0)
        return { ok: false, error: "De meterstand mag niet negatief zijn." };
    }

    // Eigendomscontrole via RLS: alleen eigen eigenaar-records zijn zichtbaar.
    const rls = await createClient();
    const { data: eigen } = await rls
      .from("eigenaar")
      .select("id")
      .eq("unit_id", unit_id)
      .limit(1);
    if (!eigen || eigen.length === 0)
      return { ok: false, error: "Dit appartement is niet van jou." };

    const { data: unit } = await rls
      .from("unit")
      .select("vme_id")
      .eq("id", unit_id)
      .maybeSingle<{ vme_id: string }>();
    if (!unit) return { ok: false, error: "Appartement niet gevonden." };

    const { boekjaar } = await getActiveContext();

    const db = createAdminClient();
    let document_id: string | null = null;
    if (file) {
      const pad = await uploadNaarDocumenten(db, unit.vme_id, file);
      const { data: doc, error: docErr } = await db
        .from("document")
        .insert({
          vme_id: unit.vme_id,
          boekjaar_id: boekjaar?.id ?? null,
          naam: file.name,
          pad,
          mimetype: file.type || null,
          grootte: file.size,
          categorie: "meterstand",
        })
        .select("id")
        .single();
      if (docErr) return { ok: false, error: docErr.message };
      document_id = doc.id as string;
    }

    const { error } = await db.from("meteropname").insert({
      vme_id: unit.vme_id,
      unit_id,
      teller_id,
      boekjaar_id: boekjaar?.id ?? null,
      document_id,
      ingediend_door: userId,
      rol: "eigenaar",
      opname_datum,
      herkende_waarde,
      herkend_meternummer: optStr(formData, "herkend_meternummer"),
      waarde: herkende_waarde,
      status: "nieuw",
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/meterstanden");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Onbekende fout.",
    };
  }
}
