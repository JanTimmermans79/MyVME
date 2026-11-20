/**
 * Actief / archief voor eigenaars en huurders. Niets wordt verwijderd: wie
 * vertrokken of verkocht is, blijft bewaard voor de historiek.
 * Pure logica (geen "server-only").
 */

const vandaag = () => new Date().toISOString().slice(0, 10);

/** Eigenaar zonder einddatum of met einddatum vandaag/later = actief. */
export function isActiefEigenaar(
  e: { eind_datum?: string | null },
  op: string = vandaag(),
): boolean {
  return !e.eind_datum || e.eind_datum >= op;
}

/** Huurder zonder uitgangsdatum of met uitgangsdatum vandaag/later = actief. */
export function isActiefHuurder(
  h: { uitgang_datum?: string | null },
  op: string = vandaag(),
): boolean {
  return !h.uitgang_datum || h.uitgang_datum >= op;
}
