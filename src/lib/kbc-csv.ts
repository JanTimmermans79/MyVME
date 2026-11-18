import { importHash, normIban, parseBedrag, parseDatum } from "./bank-parse";
import type { VmeRekening } from "./types";

/**
 * Parser voor de "Export" van KBC Touch / KBC Online als CSV (puntkomma-
 * gescheiden). Alles wat de app nodig heeft zit al in de kolommen — er hoeft
 * dus niets handmatig toegewezen te worden:
 *
 *   Rekeningnummer ; … ; Afschriftnummer ; Datum ; Omschrijving ; Valuta ;
 *   Bedrag ; Saldo ; credit ; debet ; rekeningnummer tegenpartij ;
 *   BIC tegenpartij ; Naam tegenpartij ; Adres tegenpartij ;
 *   gestructureerde mededeling ; Vrije mededeling
 */

export interface KbcCsvRij {
  rekening: VmeRekening;
  datum: string; // YYYY-MM-DD
  bedrag: number;
  saldo: number | null;
  tegenpartij_naam: string | null;
  tegenpartij_iban: string | null;
  mededeling: string | null;
  mandaatreferte: string | null;
  import_hash: string;
}

export interface KbcCsvGroep {
  rekening: VmeRekening;
  rekeningnummer: string;
  rijen: KbcCsvRij[];
  periode_van: string;
  periode_tot: string;
  saldo_begin: number | null;
  saldo_eind: number | null;
  /** true = saldo na elke verrichting sluit aan; null = niet te controleren */
  saldoKlopt: boolean | null;
}

export interface KbcCsvResultaat {
  groepen: KbcCsvGroep[];
  /** Rijen die niet gelezen konden worden (met reden). */
  fouten: string[];
}

export interface KbcCsvIbans {
  zicht: string | null;
  spaar: string | null;
}

const VERPLICHT = [
  "rekeningnummer",
  "datum",
  "omschrijving",
  "bedrag",
  "saldo",
  "rekeningnummer tegenpartij",
  "naam tegenpartij",
  "vrije mededeling",
];

/** Zet de bytes van het bestand om naar tekst (KBC levert soms Windows-1252). */
export function decodeCsv(data: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(data);
  const tekst = utf8.includes("�")
    ? new TextDecoder("windows-1252").decode(data)
    : utf8;
  // KBC vult sommige exports aan met NUL-bytes achteraan.
  return tekst.replace(/^﻿/, "").replace(/\u0000/g, "");
}

function splitRij(lijn: string): string[] {
  const velden: string[] = [];
  let huidig = "";
  let inQuotes = false;
  for (let i = 0; i < lijn.length; i++) {
    const c = lijn[i];
    if (c === '"') {
      if (inQuotes && lijn[i + 1] === '"') {
        huidig += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === ";" && !inQuotes) {
      velden.push(huidig);
      huidig = "";
    } else huidig += c;
  }
  velden.push(huidig);
  return velden.map((v) => v.trim());
}

const nz = (s: string | null | undefined) =>
  s ? s.replace(/\s+/g, "").toUpperCase() : null;

/** Herkent de KBC-CSV aan zijn header. */
export function isKbcCsv(tekst: string): boolean {
  const eerste = tekst.split(/\r?\n/, 1)[0] ?? "";
  const kolommen = splitRij(eerste).map((k) => k.toLowerCase());
  return VERPLICHT.every((k) => kolommen.includes(k));
}

function titel(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * De omschrijving bevat bij domiciliëringen, bankkosten en rente de enige
 * herkenbare info over de tegenpartij. De PDF-import gebruikte dezelfde namen
 * ("Creditrente van", "Verbruik KBC-Bedrijfsrekening", …) — we blijven daarbij
 * zodat bankrelaties (naam_bevat) voor beide bronnen werken.
 */
function afgeleideNaam(omschrijving: string): string | null {
  const o = omschrijving.replace(/\s+/g, " ").trim();

  const schuldeiser = o.match(/SCHULDEISER\s*:\s*(.+?)\s+REF\./i);
  if (schuldeiser) return titel(schuldeiser[1]);

  if (/^CREDITRENTE\b/i.test(o)) return "Creditrente van";

  const kbcKost = o.match(/^(VERBRUIK|BIJDRAGE)\b.*KBC-?BEDRIJFSREKENING/i);
  if (kbcKost)
    return `${kbcKost[1][0]}${kbcKost[1].slice(1).toLowerCase()} KBC-Bedrijfsrekening`;

  return null;
}

function afgeleideMededeling(
  vrij: string,
  gestructureerd: string,
  omschrijving: string,
): string | null {
  if (vrij) return vrij;
  const med = omschrijving.match(/MEDEDELING\s*:\s*(\S+)/i);
  if (med) return med[1];
  return gestructureerd || null;
}

/**
 * Leest een KBC-CSV. Geeft `null` als het bestand geen KBC-CSV is (dan valt de
 * importer terug op de generieke kolomtoewijzing).
 */
export function parseKbcCsv(
  tekst: string,
  ibans: KbcCsvIbans,
): KbcCsvResultaat | null {
  if (!isKbcCsv(tekst)) return null;

  const lijnen = tekst.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitRij(lijnen[0]).map((k) => k.toLowerCase());
  const idx = (naam: string) => header.indexOf(naam);
  const col = {
    rek: idx("rekeningnummer"),
    datum: idx("datum"),
    omschrijving: idx("omschrijving"),
    bedrag: idx("bedrag"),
    saldo: idx("saldo"),
    iban: idx("rekeningnummer tegenpartij"),
    naam: idx("naam tegenpartij"),
    gestr: idx("gestructureerde mededeling"),
    vrij: idx("vrije mededeling"),
  };

  const rekeningVan = (nr: string | null): VmeRekening | null => {
    if (!nr) return null;
    if (nr === nz(ibans.zicht)) return "zicht";
    if (nr === nz(ibans.spaar)) return "spaar";
    return null;
  };

  const fouten: string[] = [];
  const perRekening = new Map<
    string,
    { rekening: VmeRekening; rijen: KbcCsvRij[] }
  >();

  lijnen.slice(1).forEach((lijn, i) => {
    const v = splitRij(lijn);
    const rijNr = i + 2;
    const rekeningnummer = normIban(v[col.rek]);
    const rekening = rekeningVan(rekeningnummer);
    if (!rekeningnummer || !rekening) {
      fouten.push(
        `Rij ${rijNr}: rekening ${v[col.rek] || "?"} hoort niet bij de zicht- of spaarrekening van deze VME (controleer de IBAN's bij VME-gegevens).`,
      );
      return;
    }
    const datum = parseDatum(v[col.datum] ?? "");
    const bedrag = parseBedrag(v[col.bedrag] ?? "");
    if (!datum || bedrag === null) {
      fouten.push(`Rij ${rijNr}: datum of bedrag onleesbaar.`);
      return;
    }

    const omschrijving = v[col.omschrijving] ?? "";
    const tegenpartij_iban = normIban(v[col.iban]);
    const tegenpartij_naam =
      (v[col.naam] ?? "").trim() || afgeleideNaam(omschrijving);
    const mededeling = afgeleideMededeling(
      v[col.vrij] ?? "",
      v[col.gestr] ?? "",
      omschrijving,
    );
    const mandaat = omschrijving.match(/MANDAATREFERTE\s*:\s*([A-Z0-9]+)/i);
    const refSch = omschrijving.match(/REF\. SCHULDEISER\s*:\s*([A-Z0-9-]+)/i);

    const rij: KbcCsvRij = {
      rekening,
      datum,
      bedrag,
      saldo: parseBedrag(v[col.saldo] ?? ""),
      tegenpartij_naam,
      tegenpartij_iban,
      mededeling,
      mandaatreferte: mandaat?.[1] ?? refSch?.[1] ?? null,
      import_hash: importHash([
        rekening,
        datum,
        bedrag,
        tegenpartij_naam,
        tegenpartij_iban,
        mededeling,
        v[col.omschrijving],
      ]),
    };

    const g = perRekening.get(rekeningnummer) ?? { rekening, rijen: [] };
    g.rijen.push(rij);
    perRekening.set(rekeningnummer, g);
  });

  const groepen: KbcCsvGroep[] = [];
  for (const [rekeningnummer, g] of perRekening) {
    const rijen = g.rijen;
    const datums = rijen.map((r) => r.datum).sort();

    // KBC levert nieuwste eerst; het saldo ná rij i min bedrag i = saldo ná rij i+1.
    let saldoKlopt: boolean | null = null;
    if (rijen.every((r) => r.saldo !== null) && rijen.length > 1) {
      saldoKlopt = true;
      for (let i = 0; i < rijen.length - 1; i++) {
        const voor = (rijen[i].saldo as number) - rijen[i].bedrag;
        if (Math.abs(voor - (rijen[i + 1].saldo as number)) > 0.005) {
          saldoKlopt = false;
          break;
        }
      }
    }

    const nieuwste = rijen[0];
    const oudste = rijen[rijen.length - 1];
    groepen.push({
      rekening: g.rekening,
      rekeningnummer,
      rijen,
      periode_van: datums[0],
      periode_tot: datums[datums.length - 1],
      saldo_eind: nieuwste?.saldo ?? null,
      saldo_begin:
        oudste?.saldo != null
          ? Math.round((oudste.saldo - oudste.bedrag) * 100) / 100
          : null,
      saldoKlopt,
    });
  }

  return { groepen, fouten };
}
