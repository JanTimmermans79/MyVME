import "server-only";

import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type ActionState, IDLE } from "@/lib/action-state";

export { type ActionState, IDLE };

/**
 * Voert `fn` uit met een service-role client, maar enkel nadat is bevestigd dat
 * de huidige gebruiker syndicus is. Vangt fouten op als nette ActionState.
 */
export async function runAdmin(
  fn: (db: ReturnType<typeof createAdminClient>) => Promise<ActionState>,
): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Geen toegang." };
  }
  try {
    const db = createAdminClient();
    return await fn(db);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Onbekende fout.";
    return { ok: false, error: message };
  }
}

/**
 * Voert `fn` uit als de ingelogde gebruiker (anon key + sessie => RLS actief).
 * Voor acties die een eigenaar op zijn eigen data mag uitvoeren.
 */
export async function runUser(
  fn: (
    db: Awaited<ReturnType<typeof createClient>>,
    userId: string,
  ) => Promise<ActionState>,
): Promise<ActionState> {
  let userId: string;
  try {
    const session = await requireUser();
    userId = session.userId;
  } catch {
    return { ok: false, error: "Niet ingelogd." };
  }
  try {
    const db = await createClient();
    return await fn(db, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return { ok: false, error: message };
  }
}

export function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function optStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v.length > 0 ? v : null;
}

export function num(formData: FormData, key: string): number {
  const raw = str(formData, key).replace(/\s/g, "").replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Ongeldig getal bij "${key}".`);
  return n;
}
