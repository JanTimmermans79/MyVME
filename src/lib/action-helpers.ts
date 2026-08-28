import "server-only";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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
