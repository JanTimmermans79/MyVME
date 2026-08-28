const eurFmt = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
});

const dateFmt = new Intl.DateTimeFormat("nl-BE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function euro(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return eurFmt.format(Number.isFinite(n) ? n : 0);
}

export function datum(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
}

/** Saldo-richting voor de UI. saldo < 0 => bijbetalen. */
export function saldoRichting(saldo: number): {
  label: string;
  bijbetaling: boolean;
} {
  if (saldo < -0.005) return { label: "Bij te betalen", bijbetaling: true };
  if (saldo > 0.005) return { label: "Terug te krijgen", bijbetaling: false };
  return { label: "In evenwicht", bijbetaling: false };
}
