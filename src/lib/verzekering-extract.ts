import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PolisExtract, PolisType } from "@/lib/types";

type Db = ReturnType<typeof createAdminClient>;

export type { PolisExtract };

/** Courante Belgische verzekeraars — naam zoals ze doorgaans in de app staat. */
const VERZEKERAARS: [RegExp, string][] = [
  [/\bkbc\b/i, "KBC Verzekeringen"],
  [/\bag(?:\s|_|-)?insurance\b|\bfortis\s?ag\b|\bag\b/i, "AG Insurance"],
  [/\bbaloise\b|\bmercator\b/i, "Baloise"],
  [/\ballianz\b/i, "Allianz"],
  [/\baxa\b/i, "AXA"],
  [/\bbelfius\b/i, "Belfius Verzekeringen"],
  [/\bp&v\b|\bp\s?en\s?v\b/i, "P&V Verzekeringen"],
  [/\bethias\b/i, "Ethias"],
  [/\bdvv\b/i, "DVV"],
  [/\bfidea\b/i, "Fidea"],
  [/\bvivium\b/i, "Vivium"],
  [/\bfederale\b/i, "Federale Verzekering"],
  [/\bargenta\b/i, "Argenta Assuranties"],
];

const TYPE_TREFWOORDEN: [RegExp, PolisType][] = [
  [/rechtsbijstand/i, "rechtsbijstand"],
  [/bestuurder|mandataris/i, "bestuurdersaansprakelijkheid"],
  [/objectiev/i, "objectieve_aansprakelijkheid"],
  [/\bba[\s_-]?gebouw|burgerlijke\s?aansprakelijk/i, "ba_gebouw"],
  [/brand|incendie/i, "brand"],
];

/**
 * Leidt polisvelden af uit een geüpload document.
 *
 * Vandaag: enkel een gok op basis van de bestandsnaam (geen API-kosten). Als er
 * later een `ANTHROPIC_API_KEY` is, kan hier de PDF meegegeven en naar Claude
 * gestuurd worden (@anthropic-ai/sdk, document-block + structured output) —
 * `bron` wordt dan "ai". Voeg dan een `file: File`-parameter toe en roep die
 * branch aan. De functie faalt nooit hard: bij twijfel `{ bron: "geen" }`.
 */
export async function extraheerPolis(
  db: Db,
  vmeId: string,
  bestandsnaam: string,
): Promise<PolisExtract> {
  const naam = bestandsnaam.toLowerCase();
  const out: PolisExtract = { bron: "geen" };

  for (const [re, label] of VERZEKERAARS) {
    if (re.test(naam)) {
      out.maatschappij = label;
      break;
    }
  }

  // Ook tegen de leveranciersnamen van deze VME matchen (bv. "Fortis AG").
  if (!out.maatschappij) {
    const { data } = await db
      .from("bankrelatie")
      .select("naam, standaard_categorie")
      .eq("vme_id", vmeId);
    for (const r of (data ?? []) as {
      naam: string;
      standaard_categorie: string | null;
    }[]) {
      const kern = r.naam.toLowerCase().split(/\s+/)[0];
      if (kern.length >= 3 && naam.includes(kern)) {
        out.maatschappij = r.naam;
        break;
      }
    }
  }

  for (const [re, type] of TYPE_TREFWOORDEN) {
    if (re.test(naam)) {
      out.type = type;
      break;
    }
  }

  if (out.maatschappij || out.type) {
    out.bron = "bestandsnaam";
    out.waarschuwing =
      "Ingevuld op basis van de bestandsnaam — controleer alle velden.";
  }
  return out;
}
