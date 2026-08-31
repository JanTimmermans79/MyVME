import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Actieve categorienamen van een VME (leeg = migratie/seed nog niet gedraaid). */
export async function actieveCategorieNamen(
  db: Db,
  vmeId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("categorie")
    .select("naam")
    .eq("vme_id", vmeId)
    .eq("actief", true)
    .order("naam");
  if (error || !data) return [];
  return (data as { naam: string }[]).map((c) => c.naam);
}
