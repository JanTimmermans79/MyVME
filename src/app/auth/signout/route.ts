import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientEnv } from "@/lib/env";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${clientEnv.siteUrl}/login`, { status: 303 });
}
