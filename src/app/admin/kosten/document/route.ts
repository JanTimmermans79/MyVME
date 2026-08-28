import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Geeft een korte-termijn signed URL terug voor een kostendocument (admin). */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new NextResponse("Geen toegang", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return new NextResponse("path ontbreekt", { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db.storage
    .from("documenten")
    .createSignedUrl(path, 60);

  if (error || !data)
    return new NextResponse("Document niet gevonden", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
