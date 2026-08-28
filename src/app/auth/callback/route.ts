import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Wisselt de magic-link `code` (of `token_hash`) in voor een sessie en stuurt
 * door. De sessiecookies worden hier gezet (een Route Handler mag cookies
 * schrijven). We redirecten t.o.v. de ECHTE request-origin — niet t.o.v.
 * NEXT_PUBLIC_SITE_URL — zodat de cookies op hetzelfde domein blijven, ook als
 * die env-var niet exact klopt.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : url.origin;

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const authError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] exchangeCodeForSession:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "magiclink" | "recovery" | "invite",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] verifyOtp:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  console.error(
    "[auth/callback] geen code/token_hash. params:",
    url.search,
    authError ?? "",
  );
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(authError ?? "geen code ontvangen")}`,
  );
}
