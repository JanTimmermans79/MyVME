import "server-only";

import type { BetalerType } from "@/lib/types";

const COMBINING_MARKS = /[̀-ͯ]/g;

export function normNaam(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-set gelijkenis 0..1. */
export function naamSimilarity(a: string, b: string): number {
  const ta = new Set(normNaam(a).split(" ").filter(Boolean));
  const tb = new Set(normNaam(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  return overlap / Math.max(ta.size, tb.size);
}

/** Enkel de cijfers uit een string. */
function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Match op gestructureerde mededeling: de cijferreeks in de mededeling begint
 * met de (genormaliseerde) prefix van de eigenaar. Prefix moet >= 3 cijfers zijn.
 */
export function structuurMatch(
  mededeling: string | null,
  prefix: string | null,
): boolean {
  if (!mededeling || !prefix) return false;
  const p = digits(prefix);
  if (p.length < 3) return false;
  const m = digits(mededeling);
  if (m.length < p.length) return false;
  return m.startsWith(p) || m.includes(p);
}

export interface Kandidaat {
  unit_id: string;
  betaler_type: BetalerType;
  naam: string;
  iban: string | null;
  structuurcode_prefix: string | null;
}

export interface MatchUitkomst {
  gematchte_unit_id: string | null;
  betaler_type: BetalerType | null;
  match_type: "automatisch" | "onbevestigd";
  reden?: "iban" | "structuurcode";
}

const ONBEVESTIGD: MatchUitkomst = {
  gematchte_unit_id: null,
  betaler_type: null,
  match_type: "onbevestigd",
};

function normIbanLoose(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, "").toUpperCase();
  return s.length >= 8 ? s : null;
}

/**
 * Automatische match: eerst op IBAN van de tegenpartij, dan op de
 * structuurcode-prefix. Naamgelijkenis is een suggestie, geen auto-match.
 */
export function autoMatch(
  tx: { tegenpartij_iban: string | null; mededeling: string | null },
  kandidaten: Kandidaat[],
): MatchUitkomst {
  const txIban = normIbanLoose(tx.tegenpartij_iban);
  if (txIban) {
    const hit = kandidaten.find((k) => normIbanLoose(k.iban) === txIban);
    if (hit)
      return {
        gematchte_unit_id: hit.unit_id,
        betaler_type: hit.betaler_type,
        match_type: "automatisch",
        reden: "iban",
      };
  }

  for (const k of kandidaten) {
    if (structuurMatch(tx.mededeling, k.structuurcode_prefix)) {
      return {
        gematchte_unit_id: k.unit_id,
        betaler_type: k.betaler_type,
        match_type: "automatisch",
        reden: "structuurcode",
      };
    }
  }
  return ONBEVESTIGD;
}

export interface Suggestie {
  unit_id: string;
  betaler_type: BetalerType;
  naam: string;
  score: number;
}

/** Beste naam-suggestie voor een tegenpartij; null als niets boven de drempel. */
export function suggestie(
  tegenpartijNaam: string | null,
  kandidaten: Kandidaat[],
  drempel = 0.5,
): Suggestie | null {
  if (!tegenpartijNaam) return null;
  let best: Suggestie | null = null;
  for (const k of kandidaten) {
    const score = naamSimilarity(tegenpartijNaam, k.naam);
    if (score >= drempel && (!best || score > best.score)) {
      best = {
        unit_id: k.unit_id,
        betaler_type: k.betaler_type,
        naam: k.naam,
        score,
      };
    }
  }
  return best;
}
