import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Uploadt een bestand naar de storage-bucket `documenten` en geeft het pad terug.
 * Gedeeld door de Documenten-upload en de polis-drop-flow.
 */
export async function uploadNaarDocumenten(
  db: Db,
  vmeId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const pad = `${vmeId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await db.storage
    .from("documenten")
    .upload(pad, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Upload mislukt: ${error.message}`);
  return pad;
}
