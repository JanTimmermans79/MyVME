"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";
import {
  ACTIVE_VME_COOKIE,
  ACTIVE_BOEKJAAR_COOKIE,
} from "@/lib/vme-context";

type VmeFields = {
  naam: string;
  adres: string | null;
  iban: string | null;
  iban_reserve: string | null;
  aantal_kavels: number | null;
  ondernemingsnummer: string | null;
  rechtsvorm: string | null;
  type_entiteit: string | null;
  kbo_status: string | null;
  rechtstoestand: string | null;
  begindatum: string | null;
  officiele_naam: string | null;
  afkorting: string | null;
  zetel_adres: string | null;
  telefoon: string | null;
  email: string | null;
  webadres: string | null;
  syndicus_naam: string | null;
  syndicus_sinds: string | null;
};

/** Leeg of een geldige ISO-datum (YYYY-MM-DD) uit een <input type="date">. */
function optDate(formData: FormData, key: string): string | null | { error: string } {
  const v = str(formData, key);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `Ongeldige datum bij "${key}".` };
  return v;
}

function parseVme(formData: FormData): VmeFields | { error: string } {
  const naam = str(formData, "naam");
  if (!naam) return { error: "Naam is verplicht." };

  const aantalRaw = str(formData, "aantal_kavels");
  let aantal_kavels: number | null = null;
  if (aantalRaw) {
    const n = Number.parseInt(aantalRaw, 10);
    if (!Number.isFinite(n) || n < 0)
      return { error: "Aantal appartementen moet een positief geheel getal zijn." };
    aantal_kavels = n;
  }

  const begindatum = optDate(formData, "begindatum");
  if (begindatum && typeof begindatum === "object") return begindatum;
  const syndicus_sinds = optDate(formData, "syndicus_sinds");
  if (syndicus_sinds && typeof syndicus_sinds === "object") return syndicus_sinds;

  return {
    naam,
    adres: optStr(formData, "adres"),
    iban: optStr(formData, "iban"),
    iban_reserve: optStr(formData, "iban_reserve"),
    aantal_kavels,
    ondernemingsnummer: optStr(formData, "ondernemingsnummer"),
    rechtsvorm: optStr(formData, "rechtsvorm"),
    type_entiteit: optStr(formData, "type_entiteit"),
    kbo_status: optStr(formData, "kbo_status"),
    rechtstoestand: optStr(formData, "rechtstoestand"),
    begindatum,
    officiele_naam: optStr(formData, "officiele_naam"),
    afkorting: optStr(formData, "afkorting"),
    zetel_adres: optStr(formData, "zetel_adres"),
    telefoon: optStr(formData, "telefoon"),
    email: optStr(formData, "email"),
    webadres: optStr(formData, "webadres"),
    syndicus_naam: optStr(formData, "syndicus_naam"),
    syndicus_sinds,
  };
}

export async function createVme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let nieuwId: string | null = null;
  const res = await runAdmin(async (db) => {
    const fields = parseVme(formData);
    if ("error" in fields) return { ok: false, error: fields.error };

    const { data, error } = await db
      .from("vme")
      .insert(fields)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    nieuwId = data.id as string;
    revalidatePath("/admin/vme");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "VME aangemaakt." };
  });

  // Nieuwe VME meteen als werkcontext zetten en erin springen. redirect() moet
  // buiten runAdmin gebeuren (die vangt de NEXT_REDIRECT-throw anders op).
  if (res.ok && nieuwId) {
    const c = await cookies();
    c.set(ACTIVE_VME_COOKIE, nieuwId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    c.delete(ACTIVE_BOEKJAAR_COOKIE);
    redirect("/admin/instellingen");
  }
  return res;
}

export async function updateVme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen VME." };
    const fields = parseVme(formData);
    if ("error" in fields) return { ok: false, error: fields.error };

    const { error } = await db.from("vme").update(fields).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/vme");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function deleteVme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Geen VME." };

    const { count } = await db
      .from("unit")
      .select("id", { count: "exact", head: true })
      .eq("vme_id", id);
    if ((count ?? 0) > 0)
      return {
        ok: false,
        error: "Verwijder eerst alle units van deze VME.",
      };

    const { error } = await db.from("vme").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/vme");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "VME verwijderd." };
  });
}
