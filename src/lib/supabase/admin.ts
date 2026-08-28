import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Service-role client. BYPASST RLS volledig. Uitsluitend server-side gebruiken
 * en nooit rechtstreeks aan clientcode doorgeven. Roep altijd eerst
 * requireAdmin() aan voor je hiermee schrijft.
 */
export function createAdminClient() {
  const { supabaseUrl, serviceRoleKey } = serverEnv();
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
