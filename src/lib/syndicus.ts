/**
 * Syndicuskosten: een instelbaar % wordt aan de huurders doorgerekend, de rest
 * blijft bij de eigenaars. Pure logica (geen "server-only") zodat huurder- en
 * eigenaarsafrekening exact dezelfde regel gebruiken.
 */

export const SYNDICUS_CATEGORIE = "syndicus";

/** Leest het % uit een eenheidsprijs-rij (kolom ontbreekt of leeg = 0 %). */
export function leesSyndicusPct(
  ep: { syndicus_pct_huurders?: number | string | null } | null | undefined,
): number {
  const n = Number(ep?.syndicus_pct_huurders ?? 0);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

/**
 * Een syndicuskost die op de eigenaars staat (gelijk / per quotiteit). Een
 * syndicuskost die uitdrukkelijk 'gelijk over de huurders' is, volgt de gewone
 * huurderregel en valt hier buiten.
 */
export function isSyndicusOpEigenaars(k: {
  categorie: string;
  verdeling: string;
}): boolean {
  return (
    k.categorie.trim().toLowerCase() === SYNDICUS_CATEGORIE &&
    (k.verdeling === "gelijk_eigenaars" || k.verdeling === "per_quotiteit")
  );
}
