import "server-only";

import type {
  BetalerType,
  MatchType,
  TransactieSoort,
  VmeRekening,
} from "@/lib/types";

function nz(s: string | null | undefined): string | null {
  return s ? s.replace(/\s+/g, "").toUpperCase() : null;
}

export interface ClassifyContext {
  rekening: VmeRekening | null;
  vmeZichtIban: string | null;
  vmeSpaarIban: string | null;
  /** eigenaars met een IBAN */
  owners: { unit_id: string; iban: string | null }[];
  /** huurders/bewoners met een IBAN (incl. eventueel eigenaar-bewoner) */
  occupants: { unit_id: string; iban: string | null }[];
  bankrelaties: {
    iban: string;
    type: string;
    mandaatreferte: string | null;
  }[];
}

export interface ClassifyInput {
  bedrag: number;
  tegenpartij_naam: string | null;
  tegenpartij_iban: string | null;
  mededeling: string | null;
  mandaatreferte?: string | null;
}

export interface Classificatie {
  soort: TransactieSoort;
  gematchte_unit_id: string | null;
  betaler_type: BetalerType | null;
  match_type: MatchType;
}

const RE_AFREKENING = /afrekening/i; // dekt ook EINDAFREKENING
const RE_KAPITAAL = /gevel|renovatie|\bwerken\b|kapitaal|oproep/i;
const RE_RENTE = /creditrente|\brente\b/i;

export function classificeer(
  tx: ClassifyInput,
  ctx: ClassifyContext,
): Classificatie {
  const rek: VmeRekening = ctx.rekening ?? "zicht";
  const txIban = nz(tx.tegenpartij_iban);
  const med = tx.mededeling ?? "";
  const naam = tx.tegenpartij_naam ?? "";

  const owner = txIban
    ? ctx.owners.find((o) => nz(o.iban) === txIban)
    : undefined;
  const occ = txIban
    ? ctx.occupants.find((o) => nz(o.iban) === txIban)
    : undefined;
  const rel = ctx.bankrelaties.find(
    (r) =>
      (txIban && nz(r.iban) === txIban) ||
      (tx.mandaatreferte && r.mandaatreferte === tx.mandaatreferte),
  );

  // interne overboeking tussen de eigen rekeningen
  if (
    txIban &&
    (txIban === nz(ctx.vmeZichtIban) || txIban === nz(ctx.vmeSpaarIban))
  ) {
    return {
      soort: "interne_overboeking",
      gematchte_unit_id: null,
      betaler_type: null,
      match_type: "automatisch",
    };
  }

  if (RE_RENTE.test(naam) || RE_RENTE.test(med)) {
    return {
      soort: "rente",
      gematchte_unit_id: null,
      betaler_type: null,
      match_type: "automatisch",
    };
  }

  // vorig-boekjaar afrekening (niet meetellen als voorschot)
  if (tx.bedrag > 0 || RE_AFREKENING.test(med)) {
    if (RE_AFREKENING.test(med)) {
      const w = occ ?? owner;
      return {
        soort: "afrekening",
        gematchte_unit_id: w?.unit_id ?? null,
        betaler_type: w ? (occ ? "huurder" : "eigenaar") : null,
        match_type: w ? "automatisch" : "onbevestigd",
      };
    }
  }

  // inkomend op de SPAARrekening = eigenaars-reservefonds of kapitaalsoproep
  if (rek === "spaar" && tx.bedrag > 0 && owner) {
    return {
      soort: RE_KAPITAAL.test(med) ? "kapitaalsoproep" : "voorschot",
      gematchte_unit_id: owner.unit_id,
      betaler_type: "eigenaar",
      match_type: "automatisch",
    };
  }

  // inkomend op de ZICHTrekening = bewonersvoorschot gemeenschappelijke kosten
  if (rek === "zicht" && tx.bedrag > 0) {
    if (occ) {
      return {
        soort: "voorschot",
        gematchte_unit_id: occ.unit_id,
        betaler_type: "huurder",
        match_type: "automatisch",
      };
    }
    if (owner) {
      // eigenaar-bewoner die vanaf zijn eigenaarrekening betaalt
      return {
        soort: "voorschot",
        gematchte_unit_id: owner.unit_id,
        betaler_type: "huurder",
        match_type: "manueel",
      };
    }
  }

  // betaling aan / terugbetaling van een gekende leverancier = kost
  if (rel?.type === "leverancier") {
    return {
      soort: "kost",
      gematchte_unit_id: null,
      betaler_type: null,
      match_type: "automatisch",
    };
  }

  // overige uitgaande betaling = (nog te classificeren) kost
  if (tx.bedrag < 0) {
    return {
      soort: "kost",
      gematchte_unit_id: null,
      betaler_type: null,
      match_type: "onbevestigd",
    };
  }

  return {
    soort: "overig",
    gematchte_unit_id: null,
    betaler_type: null,
    match_type: "onbevestigd",
  };
}
