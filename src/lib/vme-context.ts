import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Boekjaar, Vme } from "@/lib/types";

export const ACTIVE_VME_COOKIE = "myvme_active_vme";
export const ACTIVE_BOEKJAAR_COOKIE = "myvme_active_boekjaar";

export interface ActiveContext {
  vmes: Vme[];
  vme: Vme | null;
  boekjaren: Boekjaar[];
  boekjaar: Boekjaar | null;
}

/**
 * De actieve werkcontext van de admin: één VME + één boekjaar.
 * Alle boekjaar-gebonden schermen (kosten, voorschotten, meterstanden,
 * bankimport, afrekeningen) werken automatisch in dit boekjaar.
 */
export async function getActiveContext(): Promise<ActiveContext> {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const { data: vmeData } = await supabase
    .from("vme")
    .select("*")
    .order("naam", { ascending: true });
  const vmes = (vmeData as Vme[] | null) ?? [];
  if (vmes.length === 0)
    return { vmes, vme: null, boekjaren: [], boekjaar: null };

  const wantedVme = cookieStore.get(ACTIVE_VME_COOKIE)?.value;
  const vme = vmes.find((v) => v.id === wantedVme) ?? vmes[0];

  const { data: bjData } = await supabase
    .from("boekjaar")
    .select("*")
    .eq("vme_id", vme.id)
    .order("start_datum", { ascending: false });
  const boekjaren = (bjData as Boekjaar[] | null) ?? [];

  const wantedBj = cookieStore.get(ACTIVE_BOEKJAAR_COOKIE)?.value;
  const vandaag = new Date().toISOString().slice(0, 10);
  const boekjaar =
    boekjaren.find((b) => b.id === wantedBj) ??
    boekjaren.find(
      (b) => b.start_datum <= vandaag && vandaag <= b.eind_datum,
    ) ??
    boekjaren.find((b) => b.status === "open") ??
    boekjaren[0] ?? // nieuwste (lijst is desc gesorteerd)
    null;

  return { vmes, vme, boekjaren, boekjaar };
}

/** Compat: enkel de VME (voor schermen die geen boekjaar nodig hebben). */
export async function getActiveVme(): Promise<{
  vmes: Vme[];
  active: Vme | null;
}> {
  const ctx = await getActiveContext();
  return { vmes: ctx.vmes, active: ctx.vme };
}
