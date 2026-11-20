import type { HuurderAfrekeningResultaat } from "@/lib/huurder-afrekening";

/**
 * Overzicht van de meterstanden van één huurder zoals in de Excel-afrekening
 * (tab "Details <huurder>"): startstand, eindstand, delta, liters en euro.
 * Pure berekening op basis van het resultaat van de huurdersafrekening.
 */

export interface KaartRij {
  label: string;
  begin: number | null;
  eind: number | null;
  delta: number;
  /** Hoeveelheid in liter (stookolie) of m³ (water). */
  hoeveelheid: number;
  eenheid: "liter" | "m³";
  bedrag: number;
  beginDatum: string | null;
  eindDatum: string | null;
}

export interface KaartBlok {
  rijen: KaartRij[];
  totaalHoeveelheid: number;
  eenheid: "liter" | "m³";
  totaalBedrag: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const WATER_SOORTEN = ["koud_water", "warm_water", "water_basis", "water_comfort"];

export function bouwKaart(
  h: HuurderAfrekeningResultaat,
  parameters: { cv_liter_per_m3: number; warmwater_liter_per_m3: number },
): { stookolie: KaartBlok; water: KaartBlok } {
  const { cv, warm, koud } = h.meters;

  const stookolieLijn = h.lijnen.find((l) => l.soort === "stookolie");
  const prijsPerLiter = stookolieLijn?.eenheidsprijs ?? 0;

  const literCv = round3(cv.delta * parameters.cv_liter_per_m3);
  const literWarm = round3(warm.delta * parameters.warmwater_liter_per_m3);
  const stookolieRijen: KaartRij[] = [
    {
      label: "Delta meterstand stookolie CV",
      begin: cv.begin?.waarde ?? null,
      eind: cv.eind?.waarde ?? null,
      delta: cv.delta,
      hoeveelheid: literCv,
      eenheid: "liter",
      bedrag: round2(literCv * prijsPerLiter),
      beginDatum: cv.begin?.datum ?? null,
      eindDatum: cv.eind?.datum ?? null,
    },
    {
      label: "Delta meterstand stookolie warm water",
      begin: warm.begin?.waarde ?? null,
      eind: warm.eind?.waarde ?? null,
      delta: warm.delta,
      hoeveelheid: literWarm,
      eenheid: "liter",
      bedrag: round2(literWarm * prijsPerLiter),
      beginDatum: warm.begin?.datum ?? null,
      eindDatum: warm.eind?.datum ?? null,
    },
  ];

  // Waterbedrag (vaste prijs of basis-/comforttarief) naar verhouding over
  // warm en koud water verdeeld.
  const waterTotaal = round2(
    h.lijnen
      .filter((l) => WATER_SOORTEN.includes(l.soort))
      .reduce((s, l) => s + l.bedrag, 0),
  );
  const m3 = warm.delta + koud.delta;
  const warmBedrag = m3 > 0 ? round2((waterTotaal * warm.delta) / m3) : 0;
  const waterRijen: KaartRij[] = [
    {
      label: "Delta meterstand warm water",
      begin: warm.begin?.waarde ?? null,
      eind: warm.eind?.waarde ?? null,
      delta: warm.delta,
      hoeveelheid: warm.delta,
      eenheid: "m³",
      bedrag: warmBedrag,
      beginDatum: warm.begin?.datum ?? null,
      eindDatum: warm.eind?.datum ?? null,
    },
    {
      label: "Delta meterstand koud water",
      begin: koud.begin?.waarde ?? null,
      eind: koud.eind?.waarde ?? null,
      delta: koud.delta,
      hoeveelheid: koud.delta,
      eenheid: "m³",
      bedrag: round2(waterTotaal - warmBedrag),
      beginDatum: koud.begin?.datum ?? null,
      eindDatum: koud.eind?.datum ?? null,
    },
  ];

  const som = (rijen: KaartRij[]) => ({
    totaalHoeveelheid: round3(rijen.reduce((s, r) => s + r.hoeveelheid, 0)),
    totaalBedrag: round2(rijen.reduce((s, r) => s + r.bedrag, 0)),
  });
  return {
    stookolie: { rijen: stookolieRijen, eenheid: "liter", ...som(stookolieRijen) },
    water: { rijen: waterRijen, eenheid: "m³", ...som(waterRijen) },
  };
}
