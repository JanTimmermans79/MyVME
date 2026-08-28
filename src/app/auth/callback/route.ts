import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientEnv } from "@/lib/env";

/**
 * Wisselt de magic-link `code` in voor een sessie en stuurt door.
 * De sessiecookies worden hier gezet (Route Handler mag cookies schrijven).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";
  const base = clientEnv.siteUrl;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "magiclink" | "recovery" | "invite",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }

  return NextResponse.redirect(`${base}/login?error=auth`);
}
