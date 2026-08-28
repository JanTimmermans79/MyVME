import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

/** Huidige gebruiker + profiel, of null als niet ingelogd. */
export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { userId: user.id, email: user.email ?? null, profile: profile ?? null };
}

/** Vereist een ingelogde gebruiker; anders redirect naar /login. */
export async function requireUser(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Vereist een ingelogde syndicus; anders redirect. */
export async function requireAdmin(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile?.is_admin) redirect("/dashboard");
  return session;
}
