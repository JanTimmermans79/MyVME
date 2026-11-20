import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import {
  berekenHuurderAfrekeningen,
  type HuurderAfrekeningResultaat,
} from "@/lib/huurder-afrekening";
import { EENHEIDSPRIJS_DEFAULTS, type Eenheidsprijs } from "@/lib/types";

export interface HuurderContext {
  boekjaar: { id: string; start_datum: string; eind_datum: string };
  vme: { id: string; naam: string; iban: string | null; adres: string | null };
  resultaten: HuurderAfrekeningResultaat[];
  parameters: { cv_liter_per_m3: number; warmwater_liter_per_m3: number };
}

/** Berekende huurdersafrekeningen van het gekozen boekjaar (read-only gebruik). */
export async function laadHuurderContext(): Promise<HuurderContext | null> {
  const { vme, boekjaar } = await getActiveContext();
  if (!vme || !boekjaar) return null;
  const db = createAdminClient();

  const [resultaten, { data: ep }] = await Promise.all([
    berekenHuurderAfrekeningen(db, boekjaar.id),
    db
      .from("eenheidsprijs")
      .select("*")
      .eq("vme_id", vme.id)
      .eq("boekjaar_id", boekjaar.id)
      .maybeSingle<Eenheidsprijs>(),
  ]);

  return {
    boekjaar,
    vme: { id: vme.id, naam: vme.naam, iban: vme.iban, adres: vme.adres },
    resultaten: resultaten.sort(
      (a, b) =>
        a.unit_naam.localeCompare(b.unit_naam) ||
        a.periode_start.localeCompare(b.periode_start),
    ),
    parameters: {
      cv_liter_per_m3: Number(
        ep?.cv_liter_per_m3 ?? EENHEIDSPRIJS_DEFAULTS.cv_liter_per_m3,
      ),
      warmwater_liter_per_m3: Number(
        ep?.warmwater_liter_per_m3 ?? EENHEIDSPRIJS_DEFAULTS.warmwater_liter_per_m3,
      ),
    },
  };
}
