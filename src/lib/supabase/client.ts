"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

/** Supabase-client voor gebruik in Client Components (anon key, RLS actief). */
export function createClient() {
  return createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey);
}
