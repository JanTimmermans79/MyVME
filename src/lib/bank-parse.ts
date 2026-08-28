import * as XLSX from "xlsx";

export type Veld =
  | "datum"
  | "bedrag"
  | "tegenpartij_naam"
  | "mededeling"
  | "negeren";

export interface Mapping {
  [columnIndex: number]: Veld;
}

export interface ParsedTx {
  datum: string; // YYYY-MM-DD
  bedrag: number;
  tegenpartij_naam: string | null;
  mededeling: string | null;
  import_hash: string;
}

export interface Sheet {
  columns: string[];
  rows: string[][];
}

/** Leest de eerste tab van een XLS/XLSX-bestand als tabel van strings. */
export function parseWorkbook(data: ArrayBuffer): Sheet {
  const wb = XLSX.read(data, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  // Zoek de headerrij: eerste rij met minstens 3 niet-lege cellen.
  let headerIdx = matrix.findIndex(
    (r) => r.filter((c) => String(c).trim() !== "").length >= 3,
  );
  if (headerIdx < 0) headerIdx = 0;

  const columns = (matrix[headerIdx] ?? []).map((c) => String(c).trim());
  const rows = matrix
    .slice(headerIdx + 1)
    .map((r) => columns.map((_, i) => String(r[i] ?? "").trim()))
    .filter((r) => r.some((c) => c !== ""));

  return { columns, rows };
}

const HINTS: Record<Exclude<Veld, "negeren">, RegExp> = {
  datum: /datum|date|boekingsdatum|valuta|uitvoering/i,
  bedrag: /bedrag|amount|montant|debet|credit/i,
  tegenpartij_naam: /tegenpartij|naam|begunstigde|opdrachtgever|counterparty|name/i,
  mededeling: /mededeling|communicatie|communication|omschrijving|details|libell|referte|vrije/i,
};

/** Raadt per kolom welk veld het is, op basis van de header. */
export function autoMap(columns: string[]): Mapping {
  const mapping: Mapping = {};
  const gebruikt = new Set<Veld>();
  columns.forEach((col, i) => {
    mapping[i] = "negeren";
    for (const veld of [
      "datum",
      "bedrag",
      "tegenpartij_naam",
      "mededeling",
    ] as const) {
      if (!gebruikt.has(veld) && HINTS[veld].test(col)) {
        mapping[i] = veld;
        gebruikt.add(veld);
        break;
      }
    }
  });
  return mapping;
}

/** Normaliseert een bedrag met NL/EN notatie naar een number. */
export function parseBedrag(raw: string): number | null {
  let s = raw.replace(/\s/g, "").replace(/€|EUR/gi, "");
  if (s === "") return null;
  const negatief = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()]/g, "").replace(/^-/, "");
  // Laatste scheidingsteken is de decimaal.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negatief ? -n : n;
}

/** Normaliseert een datum (dd/mm/jjjj, jjjj-mm-dd, Excel-serienummer) naar YYYY-MM-DD. */
export function parseDatum(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Excel-serienummer
  if (/^\d{4,6}$/.test(s)) {
    const serial = Number(s);
    const ms = (serial - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    if (!Number.isNaN(dt.getTime()))
      return dt.toISOString().slice(0, 10);
  }
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

/** Deterministische hash voor dedupe bij her-import. */
export function importHash(parts: (string | number | null)[]): string {
  const base = parts.map((p) => String(p ?? "")).join("|");
  let h = 5381;
  for (let i = 0; i < base.length; i++) {
    h = (h * 33) ^ base.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface BuildResult {
  ok: ParsedTx[];
  fouten: { rij: number; reden: string }[];
}

export function buildTransactions(sheet: Sheet, mapping: Mapping): BuildResult {
  const cols: Partial<Record<Exclude<Veld, "negeren">, number>> = {};
  for (const [i, veld] of Object.entries(mapping) as [string, Veld][]) {
    if (veld !== "negeren") cols[veld] = Number(i);
  }

  const ok: ParsedTx[] = [];
  const fouten: { rij: number; reden: string }[] = [];

  sheet.rows.forEach((row, idx) => {
    const rij = idx + 1;
    const datum =
      cols.datum !== undefined ? parseDatum(row[cols.datum] ?? "") : null;
    const bedrag =
      cols.bedrag !== undefined ? parseBedrag(row[cols.bedrag] ?? "") : null;

    if (!datum) {
      fouten.push({ rij, reden: "datum onleesbaar" });
      return;
    }
    if (bedrag === null) {
      fouten.push({ rij, reden: "bedrag onleesbaar" });
      return;
    }

    const tegenpartij_naam =
      cols.tegenpartij_naam !== undefined
        ? (row[cols.tegenpartij_naam] ?? "").trim() || null
        : null;
    const mededeling =
      cols.mededeling !== undefined
        ? (row[cols.mededeling] ?? "").trim() || null
        : null;

    ok.push({
      datum,
      bedrag,
      tegenpartij_naam,
      mededeling,
      import_hash: importHash([datum, bedrag, tegenpartij_naam, mededeling]),
    });
  });

  return { ok, fouten };
}
