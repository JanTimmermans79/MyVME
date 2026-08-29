/**
 * Bepaalt of een banktransactie bij een boekjaar hoort.
 * `transactie.boekjaar_id` overschrijft de datum-afleiding.
 */

export interface BoekjaarPeriode {
  id: string;
  start_datum: string;
  eind_datum: string;
}

export interface MetDatumEnBoekjaar {
  datum: string;
  boekjaar_id?: string | null;
}

export function hoortBijBoekjaar(
  t: MetDatumEnBoekjaar,
  bj: BoekjaarPeriode,
): boolean {
  return t.boekjaar_id
    ? t.boekjaar_id === bj.id
    : t.datum >= bj.start_datum && t.datum <= bj.eind_datum;
}

/**
 * PostgREST `.or(...)`-filter: transacties die expliciet aan dit boekjaar
 * gekoppeld zijn, OF (geen expliciet boekjaar EN datum binnen de periode).
 */
export function boekjaarOrFilter(bj: BoekjaarPeriode): string {
  return [
    `boekjaar_id.eq.${bj.id}`,
    `and(boekjaar_id.is.null,datum.gte.${bj.start_datum},datum.lte.${bj.eind_datum})`,
  ].join(",");
}

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Haalt transacties voor een boekjaar op. `metKolom` gebruikt `boekjaar_id`
 * (via `boekjaarOrFilter`); als die kolom nog niet bestaat (migratie niet
 * gedraaid) valt het terug op `zonderKolom` (datum-only). Beide resultaten
 * worden nog eens met `hoortBijBoekjaar` gefilterd.
 */
export async function metBoekjaarFilter<T extends MetDatumEnBoekjaar>(
  metKolom: () => QueryResult<T>,
  zonderKolom: () => QueryResult<T>,
  bj: BoekjaarPeriode,
): Promise<T[]> {
  const res = await metKolom();
  const rijen = res.error ? ((await zonderKolom()).data ?? []) : (res.data ?? []);
  return rijen.filter((t) => hoortBijBoekjaar(t, bj));
}
