import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

/**
 * Supabase-client voor Server Components, Route Handlers en Server Actions.
 * Gebruikt de anon key + de sessiecookie van de gebruiker => RLS is actief.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.supabaseUrl,
    clientEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll aangeroepen vanuit een Server Component: mag genegeerd worden
            // zolang er proxy (middleware) is die de sessie ververst.
          }
        },
      },
    },
  );
}
