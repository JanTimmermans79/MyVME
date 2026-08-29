import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Korte-termijn signed URL voor een VME-document. De toegangscontrole gebeurt
 * via RLS op `document` met de sessie-client (syndicus of eigenaar van die VME);
 * pas daarna tekent de admin-client de URL.
 */
export async function GET(request: Request) {
  try {
    await requireUser();
  } catch {
    return new NextResponse("Geen toegang", { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new NextResponse("id ontbreekt", { status: 400 });

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("document")
    .select("pad, naam")
    .eq("id", id)
    .maybeSingle<{ pad: string; naam: string }>();
  if (!row) return new NextResponse("Document niet gevonden", { status: 404 });

  const db = createAdminClient();
  const { data, error } = await db.storage
    .from("documenten")
    .createSignedUrl(row.pad, 60, { download: row.naam });
  if (error || !data)
    return new NextResponse("Document niet gevonden", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
