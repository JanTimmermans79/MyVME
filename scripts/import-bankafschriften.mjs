/**
 * Batch-import van KBC-PDF-rekeninguittreksels in de VME-app.
 *
 *   node scripts/import-bankafschriften.mjs "<map>"          (dry-run)
 *   node scripts/import-bankafschriften.mjs "<map>" --apply   (schrijft)
 *
 * De <map> bevat bestanden "VME Mooi Zicht - {Zichtrekening|Spaarrekening} -
 * Boekjaar YYYYYYYY.pdf". Elke transactie krijgt boekjaar_id van het boekjaar
 * in de bestandsnaam. Deduplicatie op import_hash (identiek aan de app-parser).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const MAP = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!MAP) {
  console.error('Gebruik: node scripts/import-bankafschriften.mjs "<map>" [--apply]');
  process.exit(1);
}

const env = {};
for (const line of readFileSync(
  new URL("../.env.local", import.meta.url),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// --- KBC-PDF-parser (1:1 met src/lib/kbc-pdf.ts + bank-parse.ts) -----------
const pdfLib = (await import("pdf-parse/lib/pdf-parse.js")).default;
const PDFJS_BUILDS = ["v1.10.100", "v1.10.88", "v1.9.426"];

async function pdfToText(buffer) {
  let laatste;
  for (const version of PDFJS_BUILDS) {
    try {
      const { text } = await pdfLib(buffer, { version });
      if (text && text.trim().length > 50) return text;
    } catch (e) {
      laatste = e;
    }
  }
  throw laatste ?? new Error("PDF onleesbaar");
}

const normIban = (raw) => {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{6,30}$/.test(s) ? s : null;
};
const importHash = (parts) => {
  const base = parts.map((p) => String(p ?? "")).join("|");
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = (h * 33) ^ base.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
};
const parseBedrag = (s) => {
  const neg = s.trim().startsWith("-");
  const n = Number(
    s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."),
  );
  return neg && n > 0 ? -n : n;
};
const dmyToIso = (dmy) => {
  const [d, m, y] = dmy.split("-");
  return `${y}-${m}-${d}`;
};
const DATE_AMT = /^(\d{2}-\d{2}-\d{4})(.*?)(-?\d+(?:\.\d{3})*,\d{2})$/;
const STOP =
  /^(Tijdstip|Met|Overschrijving|Instantoverschrijving|Domicili|Rekeningnummer|BIC:|Referte|Mandaatreferte|Basisrente|Getrouwheid|Roerende)/;

async function parseKbcPdf(buffer) {
  const text = await pdfToText(buffer);
  let lines = text.split(/\r?\n/).map((l) => l.trim());
  const rekening = /KBC-?Spaarrekening/i.test(text)
    ? "spaar"
    : /KBC-?Bedrijfsrekening|Zichtrekening/i.test(text)
      ? "zicht"
      : null;
  const hdrIban = text.match(/(BE\d{2}(?:\s?\d{4}){3})\s*EUR/);
  const periode = text.match(
    /Datum van (\d{2}-\d{2}-\d{4}) tot en met (\d{2}-\d{2}-\d{4})/,
  );
  const saldoAlle = [
    ...text.matchAll(
      /Saldo op (\d{2}-\d{2}-\d{4}) om \d{2}:\d{2}\s*(-?[\d.]+,\d{2})/g,
    ),
  ];
  const saldoEind = saldoAlle[0]?.[2] ?? null;
  const saldoBegin = saldoAlle[saldoAlle.length - 1]?.[2] ?? null;

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

  const txns = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(DATE_AMT);
    if (!m) continue;
    const [, dmy, naamRaw, amtRaw] = m;
    const block = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (DATE_AMT.test(lines[j]) || /^Saldo op/.test(lines[j])) break;
      block.push(lines[j]);
    }
    const btext = block.join("\n");
    const ibanM = btext.match(/BE\d{2}(?:\s?\d{4}){3}/);
    let mededeling = null;
    const medIdx = block.findIndex((l) => l === "Mededeling");
    if (medIdx >= 0) {
      const rest = [];
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
  return {
    rekening,
    rekeningnummer: hdrIban ? normIban(hdrIban[1]) : null,
    periode_van: periode ? dmyToIso(periode[1]) : null,
    periode_tot: periode ? dmyToIso(periode[2]) : null,
    saldo_begin: saldoBegin ? parseBedrag(saldoBegin) : null,
    saldo_eind: saldoEind ? parseBedrag(saldoEind) : null,
    txns,
  };
}

// --- classificeer (1:1 met src/lib/bank-classify.ts, + 1 extra fallback) ---
const nz = (s) => (s ? s.replace(/\s+/g, "").toUpperCase() : null);
const RE_AFREKENING = /afrekening/i;
const RE_KAPITAAL = /gevel|renovatie|\bwerken\b|kapitaal|oproep/i;
const RE_RENTE = /creditrente|\brente\b/i;

function classificeer(tx, ctx) {
  const rek = ctx.rekening ?? "zicht";
  const txIban = nz(tx.tegenpartij_iban);
  const med = tx.mededeling ?? "";
  const naam = tx.tegenpartij_naam ?? "";
  const owner = txIban ? ctx.owners.find((o) => nz(o.iban) === txIban) : undefined;
  const occ = txIban ? ctx.occupants.find((o) => nz(o.iban) === txIban) : undefined;
  const rel = ctx.bankrelaties.find(
    (r) =>
      (txIban && nz(r.iban) === txIban) ||
      (tx.mandaatreferte && r.mandaatreferte === tx.mandaatreferte) ||
      (r.naam_bevat && naam.toUpperCase().includes(r.naam_bevat.toUpperCase())),
  );

  // Bankrente: KBC boekt die met de eigen rekening als tegenpartij -> vóór de
  // interne-overboeking-check.
  if (RE_RENTE.test(naam) || RE_RENTE.test(med))
    return { soort: "rente", gematchte_unit_id: null, betaler_type: null, match_type: "automatisch" };

  if (txIban && (txIban === nz(ctx.vmeZichtIban) || txIban === nz(ctx.vmeSpaarIban)))
    return { soort: "interne_overboeking", gematchte_unit_id: null, betaler_type: null, match_type: "automatisch" };

  if (RE_AFREKENING.test(med)) {
    const w = occ ?? owner;
    return {
      soort: "afrekening",
      gematchte_unit_id: w?.unit_id ?? null,
      betaler_type: w ? (occ ? "huurder" : "eigenaar") : null,
      match_type: w ? "automatisch" : "onbevestigd",
    };
  }

  if (rek === "spaar" && tx.bedrag > 0 && owner)
    return {
      soort: RE_KAPITAAL.test(med) ? "kapitaalsoproep" : "voorschot",
      gematchte_unit_id: owner.unit_id,
      betaler_type: "eigenaar",
      match_type: "automatisch",
    };

  if (rek === "zicht" && tx.bedrag > 0) {
    if (occ)
      return { soort: "voorschot", gematchte_unit_id: occ.unit_id, betaler_type: "huurder", match_type: "automatisch" };
    if (owner)
      return { soort: "voorschot", gematchte_unit_id: owner.unit_id, betaler_type: "huurder", match_type: "manueel" };
  }

  if (rel?.type === "leverancier")
    return { soort: "kost", gematchte_unit_id: null, betaler_type: null, match_type: "automatisch" };

  if (tx.bedrag < 0)
    return { soort: "kost", gematchte_unit_id: null, betaler_type: null, match_type: "onbevestigd" };

  // EXTRA (batch-historiek): inkomende gewone overschrijving op de zichtrekening
  // van een (nog) onbekende persoon = bewonersvoorschot, te koppelen aan een unit.
  if (
    rek === "zicht" &&
    tx.bedrag > 0 &&
    /^Overschrijving|^Instantoverschrijving/.test(tx.transactietype ?? "")
  )
    return { soort: "voorschot", gematchte_unit_id: null, betaler_type: "huurder", match_type: "onbevestigd" };

  return { soort: "overig", gematchte_unit_id: null, betaler_type: null, match_type: "onbevestigd" };
}

// --- context + boekjaren -------------------------------------------------
const { data: vmes } = await db.from("vme").select("*");
const vme = (vmes ?? []).find((v) => v.naam === "Mooi Zicht");
if (!vme) throw new Error("VME 'Mooi Zicht' niet gevonden");

const { data: unitRows } = await db.from("unit").select("id").eq("vme_id", vme.id);
const unitIds = (unitRows ?? []).map((u) => u.id);
const [{ data: eig }, { data: hu }, { data: rel }, { data: bjRows }] = await Promise.all([
  db.from("eigenaar").select("unit_id, iban").in("unit_id", unitIds),
  db.from("huurder").select("unit_id, iban").in("unit_id", unitIds),
  db.from("bankrelatie").select("iban, type, mandaatreferte, naam_bevat").eq("vme_id", vme.id),
  db.from("boekjaar").select("id, start_datum, eind_datum").eq("vme_id", vme.id),
]);
const bjById = new Map(
  (bjRows ?? []).map((b) => [b.start_datum.slice(0, 4), b]), // "2019" -> boekjaar 2019-2020
);

function ctxVoor(rekening) {
  return {
    rekening,
    vmeZichtIban: vme.iban,
    vmeSpaarIban: vme.iban_reserve,
    owners: eig ?? [],
    occupants: hu ?? [],
    bankrelaties: rel ?? [],
  };
}

const { data: reeds } = await db
  .from("transactie")
  .select("import_hash")
  .eq("vme_id", vme.id);
const bekend = new Set((reeds ?? []).map((r) => r.import_hash));

// --- verwerk elk bestand ------------------------------------------------
const files = readdirSync(MAP).filter((f) => /\.pdf$/i.test(f) && /Mooi Zicht/i.test(f));
files.sort();

let totNieuw = 0;
const huurderNamen = {}; // "YYYY-YYYY" -> { naam -> {iban, aantal, som} }

for (const fn of files) {
  const mRek = /Zichtrekening/i.test(fn) ? "zicht" : /Spaarrekening/i.test(fn) ? "spaar" : null;
  const mJaar = fn.match(/Boekjaar\s*(\d{4})(\d{4})/);
  if (!mRek || !mJaar) {
    console.log(`? overslaan: ${fn}`);
    continue;
  }
  const startJaar = String(Number(mJaar[1])); // 20192020 -> "2019"
  const bj = bjById.get(startJaar);
  const bjLabel = `${mJaar[1]}-${mJaar[2]}`;
  if (!bj) {
    console.log(`! geen boekjaar ${bjLabel} in DB — overslaan ${fn}`);
    continue;
  }

  const res = await parseKbcPdf(readFileSync(join(MAP, fn)));
  const rekening = res.rekening ?? mRek;
  const ctx = ctxVoor(rekening);
  const som = res.txns.reduce((s, t) => s + t.bedrag, 0);
  const klopt =
    res.saldo_begin != null &&
    res.saldo_eind != null &&
    Math.abs(res.saldo_begin + som - res.saldo_eind) < 0.02;

  const nieuw = res.txns
    .filter((t) => !bekend.has(t.import_hash))
    .map((t) => {
      bekend.add(t.import_hash);
      const c = classificeer(t, ctx);
      if (rekening === "zicht" && t.bedrag > 0 && c.soort === "voorschot" && c.match_type === "onbevestigd") {
        const nm = t.tegenpartij_naam ?? "?";
        ((huurderNamen[bjLabel] ??= {})[nm] ??= { iban: t.tegenpartij_iban, aantal: 0, som: 0 });
        huurderNamen[bjLabel][nm].aantal++;
        huurderNamen[bjLabel][nm].som += t.bedrag;
      }
      return {
        vme_id: vme.id,
        boekjaar_id: bj.id,
        datum: t.datum,
        bedrag: t.bedrag,
        tegenpartij_naam: t.tegenpartij_naam,
        tegenpartij_iban: t.tegenpartij_iban,
        mededeling: t.mededeling,
        bron: "pdf",
        rekening,
        soort: c.soort,
        import_hash: t.import_hash,
        gematchte_unit_id: c.gematchte_unit_id,
        betaler_type: c.betaler_type,
        match_type: c.match_type,
      };
    });

  console.log(
    `${fn}\n  ${rekening} ${bjLabel} · ${res.txns.length} verrichtingen (${nieuw.length} nieuw) · saldo ${res.saldo_begin} → ${res.saldo_eind} ${klopt ? "✓" : "⚠ WIJKT AF"}`,
  );
  totNieuw += nieuw.length;

  if (APPLY && nieuw.length) {
    const { error } = await db.from("transactie").insert(nieuw);
    if (error) throw error;
  }
  if (APPLY && res.periode_van && res.periode_tot) {
    const { data: bestaat } = await db
      .from("bankuittreksel")
      .select("id")
      .eq("vme_id", vme.id)
      .eq("rekening", rekening)
      .eq("periode_van", res.periode_van)
      .eq("periode_tot", res.periode_tot)
      .maybeSingle();
    if (!bestaat)
      await db.from("bankuittreksel").insert({
        vme_id: vme.id,
        rekening,
        bron: "pdf",
        periode_van: res.periode_van,
        periode_tot: res.periode_tot,
        saldo_begin: res.saldo_begin,
        saldo_eind: res.saldo_eind,
        aantal_verrichtingen: res.txns.length,
        bestandsnaam: fn,
      });
  }
}

console.log(`\n== ${totNieuw} nieuwe verrichtingen ${APPLY ? "GEÏMPORTEERD" : "(dry-run)"} ==`);
console.log("\nOnbekende bewoners op de zichtrekening (te koppelen aan een unit):");
for (const [jaar, namen] of Object.entries(huurderNamen).sort()) {
  console.log(` ${jaar}:`);
  for (const [nm, d] of Object.entries(namen).sort())
    console.log(`   ${nm.padEnd(32)} ${d.iban ?? "—".padEnd(16)}  ${d.aantal}x  € ${d.som.toFixed(2)}`);
}
if (!APPLY) console.log("\nDraai met --apply om te schrijven.");
