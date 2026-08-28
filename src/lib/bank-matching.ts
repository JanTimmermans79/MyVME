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
  structuurcode_prefix: string | null;
}

export interface MatchUitkomst {
  gematchte_unit_id: string | null;
  betaler_type: BetalerType | null;
  match_type: "automatisch" | "onbevestigd";
}

/** Automatische match op structuurcode. Geen naam-match hier (dat is een suggestie). */
export function autoMatch(
  mededeling: string | null,
  kandidaten: Kandidaat[],
): MatchUitkomst {
  for (const k of kandidaten) {
    if (structuurMatch(mededeling, k.structuurcode_prefix)) {
      return {
        gematchte_unit_id: k.unit_id,
        betaler_type: k.betaler_type,
        match_type: "automatisch",
      };
    }
  }
  return {
    gematchte_unit_id: null,
    betaler_type: null,
    match_type: "onbevestigd",
  };
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
