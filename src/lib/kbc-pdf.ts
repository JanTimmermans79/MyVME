import "server-only";

import { importHash, normIban, type ParsedTx } from "@/lib/bank-parse";
import type { VmeRekening } from "@/lib/types";

export interface KbcPdfTx extends ParsedTx {
  mandaatreferte: string | null;
  transactietype: string | null;
}

export interface KbcPdfResultaat {
  rekening: VmeRekening | null;
  rekeningnummer: string | null;
  periode_van: string | null;
  periode_tot: string | null;
  saldo_begin: number | null;
  saldo_eind: number | null;
  txns: KbcPdfTx[];
  fouten: string[];
}

function parseBedrag(s: string): number {
  const neg = s.trim().startsWith("-");
  const n = Number(
    s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."),
  );
  return neg && n > 0 ? -n : n;
}

function dmyToIso(dmy: string): string {
  const [d, m, y] = dmy.split("-");
  return `${y}-${m}-${d}`;
}

const DATE_AMT = /^(\d{2}-\d{2}-\d{4})(.*?)(-?\d+(?:\.\d{3})*,\d{2})$/;
const STOP = /^(Tijdstip|Met|Overschrijving|Instantoverschrijving|Domicili|Rekeningnummer|BIC:|Referte|Mandaatreferte|Basisrente|Getrouwheid|Roerende)/;

// Verschillende KBC-PDF's hebben een andere pdf.js-build nodig; probeer op volgorde.
const PDFJS_BUILDS = ["v1.10.100", "v1.10.88", "v1.9.426"];

async function pdfToText(buffer: Buffer): Promise<string> {
  const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    b: Buffer,
    o?: { version?: string },
  ) => Promise<{ text: string }>;
  let laatsteFout: unknown;
  for (const version of PDFJS_BUILDS) {
    try {
      const { text } = await pdf(buffer, { version });
      if (text && text.trim().length > 50) return text;
    } catch (err) {
      laatsteFout = err;
    }
  }
  throw laatsteFout ?? new Error("PDF kon met geen enkele parser gelezen worden.");
}

/** Parseert een KBC "Export KBC Touch" rekeninguittreksel-PDF. */
export async function parseKbcPdf(buffer: Buffer): Promise<KbcPdfResultaat> {
  const text = await pdfToText(buffer);

  const fouten: string[] = [];
  let lines = text.split(/\r?\n/).map((l) => l.trim());

  const rekening: VmeRekening | null = /KBC-?Spaarrekening/i.test(text)
    ? "spaar"
    : /KBC-?Bedrijfsrekening|Zichtrekening/i.test(text)
      ? "zicht"
      : null;

  const hdrIban = text.match(/(BE\d{2}(?:\s?\d{4}){3})\s*EUR/);
  const periode = text.match(
    /Datum van (\d{2}-\d{2}-\d{4}) tot en met (\d{2}-\d{2}-\d{4})/,
  );
  // "Saldo op DD-MM-YYYY om HH:MM<bedrag>"  (geen spatie voor het bedrag)
  const saldoAlle = [
    ...text.matchAll(
      /Saldo op (\d{2}-\d{2}-\d{4}) om \d{2}:\d{2}\s*(-?[\d.]+,\d{2})/g,
    ),
  ];
  // eerste in het document = eindsaldo (bovenaan), laatste = beginsaldo (onderaan)
  const saldoEind = saldoAlle[0]?.[2] ?? null;
  const saldoBegin = saldoAlle[saldoAlle.length - 1]?.[2] ?? null;

  // pagina-headers/-footers weg
  lines = lines.filter(
    (l) =>
      l &&
      !/^KBC Bank NV/.test(l) &&
      !/^BTW BE 0462/.test(l) &&
      !/Een onderneming van de KBC-groep/.test(l) &&
      !/Export KBC Touch/.test(l) &&
      !/^\d+\/\d+$/.test(l) &&
      l !== "EUR",
  );

  const txns: KbcPdfTx[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(DATE_AMT);
    if (!m) continue;
    const [, dmy, naamRaw, amtRaw] = m;

    const block: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (DATE_AMT.test(lines[j]) || /^Saldo op/.test(lines[j])) break;
      block.push(lines[j]);
    }
    const btext = block.join("\n");

    const ibanM = btext.match(/BE\d{2}(?:\s?\d{4}){3}/);
    let mededeling: string | null = null;
    const medIdx = block.findIndex((l) => l === "Mededeling");
    if (medIdx >= 0) {
      const rest: string[] = [];
      for (let k = medIdx + 1; k < block.length; k++) {
        if (STOP.test(block[k])) break;
        rest.push(block[k]);
      }
      mededeling = rest.join(" ").trim() || null;
    }
    const mandaat = btext.match(/Mandaatreferte\s*\n?\s*([A-Z0-9]+)/);
    const refSch = btext.match(/Referte schuldeiser\s*\n?\s*([A-Z0-9]+)/);
    const type = block.find((l) =>
      /^(Overschrijving|Instantoverschrijving|Domicili)/.test(l),
    );

    const datum = dmyToIso(dmy);
    const bedrag = parseBedrag(amtRaw);
    const tegenpartij_naam = naamRaw.trim() || null;
    const tegenpartij_iban = ibanM ? normIban(ibanM[0]) : null;
    const import_hash = importHash([
      rekening,
      datum,
      bedrag,
      tegenpartij_naam,
      tegenpartij_iban,
      mededeling,
    ]);
    if (seen.has(import_hash)) continue;
    seen.add(import_hash);

    txns.push({
      datum,
      bedrag,
      tegenpartij_naam,
      tegenpartij_iban,
      mededeling,
      import_hash,
      mandaatreferte: mandaat?.[1] ?? refSch?.[1] ?? null,
      transactietype: type ?? null,
    });
  }

  if (txns.length === 0)
    fouten.push("Geen verrichtingen herkend — is dit een KBC Touch-uittreksel?");

  return {
    rekening,
    rekeningnummer: hdrIban ? normIban(hdrIban[1]) : null,
    periode_van: periode ? dmyToIso(periode[1]) : null,
    periode_tot: periode ? dmyToIso(periode[2]) : null,
    saldo_begin: saldoBegin ? parseBedrag(saldoBegin) : null,
    saldo_eind: saldoEind ? parseBedrag(saldoEind) : null,
    txns,
    fouten,
  };
}
