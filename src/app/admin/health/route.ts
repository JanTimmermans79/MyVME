import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin-only healthcheck: welke env-vars zijn aanwezig (namen/booleans, nooit
 * waarden) en werkt de service-role client. Handig om een productie-deploy te
 * controleren.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return new NextResponse("Geen toegang", { status: 403 });
  }

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    emailjs_configured: Boolean(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID &&
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID &&
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY,
    ),
  };

  let serviceRole = "niet getest";
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = createAdminClient();
      const { error } = await db.from("vme").select("id").limit(1);
      serviceRole = error ? `FOUT: ${error.message}` : "ok";
    } catch (err) {
      serviceRole = `FOUT: ${err instanceof Error ? err.message : "onbekend"}`;
    }
  }

  return NextResponse.json({ env, serviceRole });
}
