import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { VerzekeringPolis } from "@/lib/types";

type Db = ReturnType<typeof createAdminClient>;

export type VervaltStatus = "verlopen" | "binnenkort" | "ok";

/** Vervaldag-status van een polis t.o.v. vandaag (binnenkort = ≤ 60 dagen). */
export function vervaltStatus(
  polis: Pick<VerzekeringPolis, "vervaldatum" | "actief">,
  vandaag = new Date().toISOString().slice(0, 10),
): VervaltStatus {
  if (!polis.actief || !polis.vervaldatum) return "ok";
  if (polis.vervaldatum < vandaag) return "verlopen";
  const grens = new Date(`${vandaag}T00:00:00Z`);
  grens.setUTCDate(grens.getUTCDate() + 60);
  return polis.vervaldatum <= grens.toISOString().slice(0, 10)
    ? "binnenkort"
    : "ok";
}

export interface PremieRegel {
  id: string;
  datum: string;
  bedrag: number;
  leverancier: string | null;
  omschrijving: string | null;
}

/**
 * Betaalde verzekeringspremies (kosten met categorie 'verzekering', status
 * 'bevestigd') voor een boekjaar. Als `maatschappij` meegegeven wordt, enkel de
 * kosten waarvan leverancier/omschrijving die naam bevat.
 */
export async function premiesVoorBoekjaar(
  db: Db,
  vmeId: string,
  boekjaarId: string,
  maatschappij?: string,
): Promise<{ totaal: number; regels: PremieRegel[] }> {
  const { data } = await db
    .from("kosten")
    .select("id, datum, bedrag, leverancier, omschrijving")
    .eq("vme_id", vmeId)
    .eq("boekjaar_id", boekjaarId)
    .eq("categorie", "verzekering")
    .eq("status", "bevestigd")
    .order("datum", { ascending: true });

  let regels = (data ?? []) as PremieRegel[];
  if (maatschappij) {
    // Match op de volledige naam of op het eerste betekenisvolle woord
    // ("KBC Verzekeringen" → ook "KBC ...").
    const m = maatschappij.toLowerCase().trim();
    const kern = m.split(/\s+/).find((w) => w.length >= 3) ?? m;
    const zoek = [m, kern];
    regels = regels.filter((r) => {
      const hooi = `${r.leverancier ?? ""} ${r.omschrijving ?? ""}`.toLowerCase();
      return zoek.some((s) => hooi.includes(s));
    });
  }
  const totaal =
    Math.round(regels.reduce((s, r) => s + Number(r.bedrag), 0) * 100) / 100;
  return { totaal, regels };
}
