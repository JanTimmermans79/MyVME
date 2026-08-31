import type { Kosten, Transactie, VmeRekening } from "@/lib/types";
import type { FinancieleRij } from "@/components/financiele-tabel";
import { hoortBijBoekjaar, type BoekjaarPeriode } from "@/lib/boekjaar-transacties";

const EIGENAAR_VERDELING = new Set(["gelijk_eigenaars", "per_quotiteit"]);

/** Rekening van een kost; valt terug op afleiding uit de verdeling
 *  (voor kosten die nog geen `rekening` hebben — migratie niet gedraaid). */
export function rekeningVanKost(
  k: Pick<Kosten, "verdeling"> & { rekening?: VmeRekening | null },
): VmeRekening {
  return (
    k.rekening ?? (EIGENAAR_VERDELING.has(k.verdeling) ? "spaar" : "zicht")
  );
}

/** Kosten → rijen voor de FinancieleTabel. */
export function kostenNaarRijen(
  kosten: Kosten[],
  acties?: (k: Kosten) => React.ReactNode,
): FinancieleRij[] {
  return kosten.map((k) => ({
    id: k.id,
    datum: k.datum,
    omschrijving:
      k.omschrijving ||
      k.verdeling.replace(/_/g, " ") + (k.status === "voorstel" ? " · voorstel" : ""),
    tegenpartij: k.leverancier,
    categorie: k.categorie,
    rekening: rekeningVanKost(k),
    bedrag: -Math.abs(Number(k.bedrag)), // een kost toont als uitgave
    href: `/admin/financien/kost/${k.id}`,
    acties: acties?.(k),
  }));
}

const INKOMST_LABEL: Record<string, string> = {
  voorschot: "Voorschot",
  kapitaalsoproep: "Kapitaalopvraging",
  rente: "Rente",
  afrekening: "Afrekening vorig boekjaar",
  interne_overboeking: "Overboeking tussen rekeningen",
  terugbetaling: "Terugbetaling",
};

/** Inkomende transacties van een rekening in een boekjaar → rijen. */
export function opbrengstenNaarRijen(
  transacties: Transactie[],
  bj: BoekjaarPeriode,
  rekening: VmeRekening,
): FinancieleRij[] {
  return transacties
    .filter(
      (t) =>
        t.rekening === rekening &&
        Number(t.bedrag) > 0 &&
        hoortBijBoekjaar(t, bj) &&
        t.soort !== "kost",
    )
    .map((t) => ({
      id: t.id,
      datum: t.datum,
      omschrijving:
        (INKOMST_LABEL[t.soort] ?? t.soort) +
        (t.mededeling ? ` — ${t.mededeling}` : ""),
      tegenpartij: t.tegenpartij_naam,
      categorie: t.betaler_type ?? null,
      rekening: t.rekening,
      bedrag: Number(t.bedrag),
      href: `/admin/financien/transactie/${t.id}`,
    }))
    .sort((a, b) => b.datum.localeCompare(a.datum));
}
