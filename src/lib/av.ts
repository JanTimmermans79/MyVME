import "server-only";

import type { AvMeerderheid } from "@/lib/types";

/**
 * Belgische AV-meerderheden. Basis = uitgebrachte stemmen (voor + tegen);
 * onthoudingen tellen NIET mee (art. 3.87 BW).
 */
export interface MeerderheidResultaat {
  /** Vereist aandeel van (voor+tegen), 0..1. null = niet van toepassing. */
  drempel: number | null;
  /** Behaald aandeel van (voor+tegen), 0..1. null = geen stemmen. */
  behaald: number | null;
  gehaald: boolean;
  omschrijving: string;
}

export function beoordeelMeerderheid(
  meerderheid: AvMeerderheid,
  voor: number,
  tegen: number,
): MeerderheidResultaat {
  const basis = voor + tegen;
  const behaald = basis > 0 ? voor / basis : null;

  if (meerderheid === "informatief")
    return { drempel: null, behaald, gehaald: false, omschrijving: "Informatief punt, geen stemming." };

  if (meerderheid === "unaniem") {
    const gehaald = voor > 0 && tegen === 0;
    return {
      drempel: 1,
      behaald,
      gehaald,
      omschrijving: gehaald
        ? "Unaniem aangenomen."
        : "Niet unaniem (er is minstens één tegenstem of geen enkele voorstem).",
    };
  }

  const drempel =
    meerderheid === "volstrekt" ? 0.5 : meerderheid === "twee_derde" ? 2 / 3 : 4 / 5;

  if (basis === 0)
    return { drempel, behaald: null, gehaald: false, omschrijving: "Nog geen stemmen ingevuld." };

  // 'volstrekt' = strikt meer dan de helft; de andere = minstens de drempel.
  const gehaald = meerderheid === "volstrekt" ? voor > tegen : voor / basis >= drempel;
  return {
    drempel,
    behaald,
    gehaald,
    omschrijving: `${(drempel * 100).toFixed(1).replace(".", ",")} % vereist · ${(
      (behaald ?? 0) * 100
    ).toFixed(1).replace(".", ",")} % behaald → ${gehaald ? "aangenomen" : "niet aangenomen"}`,
  };
}

/** Suggestie voor 'aangenomen' als de syndicus die niet handmatig zette. */
export function suggereerAangenomen(
  meerderheid: AvMeerderheid,
  voor: number | null,
  tegen: number | null,
): boolean | null {
  if (meerderheid === "informatief") return null;
  if (voor == null && tegen == null) return null;
  return beoordeelMeerderheid(meerderheid, voor ?? 0, tegen ?? 0).gehaald;
}

/**
 * Totale quotiteit van de VME. Val terug op het aantal appartementen als er geen
 * quotiteiten zijn ingevuld — dan telt elk appartement voor 1.
 */
export function totaleQuotiteit(units: { quotiteit: number | null }[]): {
  totaal: number;
  perUnitGewicht: (q: number | null) => number;
  opBasisVanAantal: boolean;
} {
  const metQuotiteit = units.filter((u) => u.quotiteit != null && u.quotiteit > 0);
  if (metQuotiteit.length === 0)
    return {
      totaal: units.length,
      perUnitGewicht: () => 1,
      opBasisVanAantal: true,
    };
  return {
    totaal: metQuotiteit.reduce((s, u) => s + (u.quotiteit ?? 0), 0),
    perUnitGewicht: (q) => q ?? 0,
    opBasisVanAantal: false,
  };
}
