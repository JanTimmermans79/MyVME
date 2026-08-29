"use server";

import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  num,
  type ActionState,
} from "@/lib/action-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

async function uploadDocument(
  db: Db,
  vmeId: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${vmeId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await db.storage
    .from("documenten")
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Upload mislukt: ${error.message}`);
  return path;
}

export async function createKost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    const categorie = str(formData, "categorie");
    const datum = str(formData, "datum");
    if (!vme_id || !boekjaar_id || !categorie || !datum)
      return {
        ok: false,
        error: "Boekjaar, categorie, datum en bedrag zijn verplicht.",
      };

    const bedrag = num(formData, "bedrag");
    const fileEntry = formData.get("document");
    const document_url = await uploadDocument(
      db,
      vme_id,
      fileEntry instanceof File ? fileEntry : null,
    );

    const verdeling = str(formData, "verdeling");
    const betaler_type: "huurder" | "eigenaar" =
      verdeling === "per_quotiteit" || verdeling === "gelijk_eigenaars"
        ? "eigenaar"
        : "huurder";

    const { error } = await db.from("kosten").insert({
      vme_id,
      boekjaar_id,
      categorie,
      omschrijving: optStr(formData, "omschrijving"),
      bedrag,
      datum,
      leverancier: optStr(formData, "leverancier"),
      verdeelsleutel_id: optStr(formData, "verdeelsleutel_id"),
      verdeling: [
        "individueel_verbruik",
        "gelijk_huurders",
        "per_quotiteit",
        "gelijk_eigenaars",
      ].includes(verdeling)
        ? verdeling
        : "gelijk_huurders",
      betaler_type,
      document_url,
      bron: "manueel",
      status: "bevestigd",
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/kosten");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Kost geboekt." };
  });
}

const VERDELINGEN = [
  "individueel_verbruik",
  "gelijk_huurders",
  "per_quotiteit",
  "gelijk_eigenaars",
];

function verdelingVelden(formData: FormData) {
  const verdeling = str(formData, "verdeling");
  const genormaliseerd = VERDELINGEN.includes(verdeling)
    ? verdeling
    : "gelijk_huurders";
  const betaler_type: "huurder" | "eigenaar" =
    genormaliseerd === "per_quotiteit" || genormaliseerd === "gelijk_eigenaars"
      ? "eigenaar"
      : "huurder";
  return { verdeling: genormaliseerd, betaler_type };
}

export async function updateKost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const vme_id = str(formData, "vme_id");
    const boekjaar_id = str(formData, "boekjaar_id");
    const categorie = str(formData, "categorie");
    const datum = str(formData, "datum");
    if (!id || !boekjaar_id || !categorie || !datum)
      return { ok: false, error: "Boekjaar, categorie en datum zijn verplicht." };

    const { verdeling, betaler_type } = verdelingVelden(formData);

    const patch: Record<string, unknown> = {
      boekjaar_id,
      categorie,
      bedrag: num(formData, "bedrag"),
      datum,
      leverancier: optStr(formData, "leverancier"),
      omschrijving: optStr(formData, "omschrijving"),
      verdeelsleutel_id: optStr(formData, "verdeelsleutel_id"),
      verdeling,
      betaler_type,
    };

    const fileEntry = formData.get("document");
    if (fileEntry instanceof File && fileEntry.size > 0) {
      const { data: oud } = await db
        .from("kosten")
        .select("document_url")
        .eq("id", id)
        .maybeSingle<{ document_url: string | null }>();
      patch.document_url = await uploadDocument(db, vme_id, fileEntry);
      if (oud?.document_url)
        await db.storage.from("documenten").remove([oud.document_url]);
    }

    const { error } = await db.from("kosten").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/kosten");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Kost bijgewerkt." };
  });
}

const nz = (s: string | null | undefined) =>
  s ? s.replace(/\s+/g, "").toUpperCase() : null;

/**
 * Maakt kosten-VOORSTELLEN uit banktransacties met soort='kost' die aan een
 * geconfigureerde bankrelatie gekoppeld kunnen worden. De admin bevestigt ze.
 * Een terugbetaling (inkomend) wordt een negatieve kost (krediet).
 */
export async function genereerKostenUitBank(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const vme_id = str(formData, "vme_id");
    if (!vme_id) return { ok: false, error: "Geen VME." };

    const [{ data: relaties }, { data: boekjaren }, { data: txs }, { data: reeds }] =
      await Promise.all([
        db.from("bankrelatie").select("*").eq("vme_id", vme_id),
        db
          .from("boekjaar")
          .select("id, start_datum, eind_datum")
          .eq("vme_id", vme_id),
        db
          .from("transactie")
          .select(
            "id, datum, bedrag, tegenpartij_naam, tegenpartij_iban, mededeling, soort",
          )
          .eq("vme_id", vme_id)
          .eq("soort", "kost"),
        db
          .from("kosten")
          .select("betaald_met_transactie_id")
          .eq("vme_id", vme_id)
          .not("betaald_met_transactie_id", "is", null),
      ]);

    const gekoppeld = new Set(
      (reeds ?? []).map(
        (k: { betaald_met_transactie_id: string }) => k.betaald_met_transactie_id,
      ),
    );
    const rels = (relaties ?? []) as {
      naam: string;
      iban: string | null;
      mandaatreferte: string | null;
      naam_bevat: string | null;
      standaard_categorie: string | null;
      standaard_verdeling: string | null;
      standaard_verdeelsleutel_id: string | null;
    }[];
    const bjs = (boekjaren ?? []) as {
      id: string;
      start_datum: string;
      eind_datum: string;
    }[];

    let gemaakt = 0;
    let overgeslagen = 0;

    for (const t of (txs ?? []) as {
      id: string;
      datum: string;
      bedrag: number;
      tegenpartij_naam: string | null;
      tegenpartij_iban: string | null;
      mededeling: string | null;
    }[]) {
      if (gekoppeld.has(t.id)) continue;

      const tIban = nz(t.tegenpartij_iban);
      const naam = (t.tegenpartij_naam ?? "").toUpperCase();
      const rel = rels.find(
        (r) =>
          (tIban && nz(r.iban) === tIban) ||
          (r.mandaatreferte &&
            (t.mededeling ?? "").includes(r.mandaatreferte)) ||
          (r.naam_bevat &&
            naam.includes(r.naam_bevat.toUpperCase())),
      );
      const bj = bjs.find(
        (b) => t.datum >= b.start_datum && t.datum <= b.eind_datum,
      );
      if (!rel || !rel.standaard_categorie || !bj) {
        overgeslagen += 1;
        continue;
      }

      // Een terugbetaling (inkomend) van een individueel-verbruik-leverancier
      // (bv. Watergroep) kan niet via de tellers verrekend worden -> gelijk.
      let verdeling = rel.standaard_verdeling ?? "gelijk_huurders";
      if (t.bedrag > 0 && verdeling === "individueel_verbruik")
        verdeling = "gelijk_huurders";
      const betaler_type =
        verdeling === "per_quotiteit" || verdeling === "gelijk_eigenaars"
          ? "eigenaar"
          : "huurder";

      const { error } = await db.from("kosten").insert({
        vme_id,
        boekjaar_id: bj.id,
        categorie: rel.standaard_categorie,
        bedrag: -Number(t.bedrag), // uitgaand (-) -> kost (+), terugbetaling (+) -> krediet (-)
        datum: t.datum,
        leverancier: t.tegenpartij_naam,
        verdeelsleutel_id: rel.standaard_verdeelsleutel_id,
        verdeling,
        betaler_type,
        betaald_met_transactie_id: t.id,
        bron: "ai_voorstel",
        status: "voorstel",
      });
      if (error) overgeslagen += 1;
      else gemaakt += 1;
    }

    revalidatePath("/admin/kosten");
    return {
      ok: true,
      message: `${gemaakt} kostenvoorstel(len) aangemaakt, ${overgeslagen} overgeslagen (geen bankrelatie of boekjaar).`,
    };
  });
}

export async function confirmKost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db
      .from("kosten")
      .update({ status: "bevestigd" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/kosten");
    return { ok: true, message: "Kost bevestigd." };
  });
}

export async function deleteKost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { data: row } = await db
      .from("kosten")
      .select("document_url")
      .eq("id", id)
      .maybeSingle<{ document_url: string | null }>();

    const { error } = await db.from("kosten").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    if (row?.document_url) {
      await db.storage.from("documenten").remove([row.document_url]);
    }
    revalidatePath("/admin/kosten");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Kost verwijderd." };
  });
}
