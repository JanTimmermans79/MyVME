import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Vme } from "@/lib/types";

const COOKIE = "myvme_active_vme";

export async function getVmes(): Promise<Vme[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vme")
    .select("*")
    .order("naam", { ascending: true });
  return (data as Vme[] | null) ?? [];
}

/** Actieve VME voor de admin. Cookie-keuze, met fallback op de eerste VME. */
export async function getActiveVme(): Promise<{
  vmes: Vme[];
  active: Vme | null;
}> {
  const vmes = await getVmes();
  if (vmes.length === 0) return { vmes, active: null };

  const cookieStore = await cookies();
  const wanted = cookieStore.get(COOKIE)?.value;
  const active = vmes.find((v) => v.id === wanted) ?? vmes[0];
  return { vmes, active };
}

export const ACTIVE_VME_COOKIE = COOKIE;
