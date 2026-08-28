"use server";

import { revalidatePath } from "next/cache";
import { clientEnv } from "@/lib/env";
import {
  runAdmin,
  str,
  optStr,
  type ActionState,
} from "@/lib/action-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

async function findUserByEmail(db: Db, email: string) {
  const target = email.toLowerCase();
  // Kleine schaal: doorloop de gebruikers (max ~1000).
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email?.toLowerCase() === target) ?? null;
}

async function ensureAuthUser(
  db: Db,
  email: string,
): Promise<{ userId: string } | { error: string }> {
  const existing = await findUserByEmail(db, email);
  if (existing) return { userId: existing.id };

  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${clientEnv.siteUrl}/auth/callback`,
  });
  if (data?.user) return { userId: data.user.id };

  // Fallback: gebruiker aanmaken zonder mail te versturen.
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.data?.user) return { userId: created.data.user.id };

  return {
    error:
      error?.message ??
      created.error?.message ??
      "Kon de gebruiker niet aanmaken.",
  };
}

export async function createEigenaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const unit_id = str(formData, "unit_id");
    const naam = str(formData, "naam");
    const email = str(formData, "email").toLowerCase();
    if (!unit_id || !naam || !email)
      return { ok: false, error: "Unit, naam en e-mail zijn verplicht." };

    const ensured = await ensureAuthUser(db, email);
    if ("error" in ensured) return { ok: false, error: ensured.error };

    const { error } = await db.from("eigenaar").insert({
      auth_user_id: ensured.userId,
      unit_id,
      naam,
      email,
      telefoon: optStr(formData, "telefoon"),
      iban: optStr(formData, "iban"),
      structuurcode_prefix: optStr(formData, "structuurcode_prefix"),
    });
    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Deze eigenaar is al aan deze unit gekoppeld." };
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/eigenaars");
    revalidatePath("/admin/units");
    return {
      ok: true,
      message: "Eigenaar aangemaakt. Er is een aanmeldlink verstuurd.",
    };
  });
}

export async function updateEigenaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const naam = str(formData, "naam");
    if (!id || !naam) return { ok: false, error: "Naam is verplicht." };

    const { error } = await db
      .from("eigenaar")
      .update({
        naam,
        email: optStr(formData, "email"),
        telefoon: optStr(formData, "telefoon"),
        iban: optStr(formData, "iban"),
        structuurcode_prefix: optStr(formData, "structuurcode_prefix"),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/eigenaars");
    return { ok: true, message: "Opgeslagen." };
  });
}

export async function resendInvite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const email = str(formData, "email").toLowerCase();
    if (!email) return { ok: false, error: "Geen e-mailadres." };
    const { error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${clientEnv.siteUrl}/auth/callback`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: "Aanmeldlink verstuurd." };
  });
}

export async function deleteEigenaar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAdmin(async (db) => {
    const id = str(formData, "id");
    const { error } = await db.from("eigenaar").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/eigenaars");
    revalidatePath("/admin/units");
    return {
      ok: true,
      message: "Koppeling verwijderd. Het gebruikersaccount blijft bestaan.",
    };
  });
}
