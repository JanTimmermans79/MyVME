/**
 * Eenmalig: historische huurders van VME Mooi Zicht aanmaken op basis van de
 * geïmporteerde bankverrichtingen (naam, IBAN, huurperiode = eerste t.e.m.
 * laatste betaalmaand). Appartement afgeleid uit de betaalcontinuïteit —
 * Jan controleert dit nog tegen de huurcontracten.
 *
 *   node scripts/import-huurders-historiek.mjs          (dry-run)
 *   node scripts/import-huurders-historiek.mjs --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
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
const nz = (s) => (s ? s.replace(/\s+/g, "").toUpperCase() : null);

const { data: vmes } = await db.from("vme").select("id, naam");
const vme = vmes.find((v) => v.naam === "Mooi Zicht");
const { data: units } = await db
  .from("unit")
  .select("id, naam")
  .eq("vme_id", vme.id);
const U = Object.fromEntries(units.map((u) => [u.naam, u.id]));

// --- nieuwe historische huurders -----------------------------------------
const NIEUW = [
  {
    voornaam: "Inge",
    naam: "Houben",
    iban: "BE80 7330 2244 0877",
    unit: "Appartement 1",
    ingang_datum: "2018-11-01",
    uitgang_datum: "2019-11-30",
  },
  {
    voornaam: "Christophe",
    naam: "Slegers",
    iban: "BE53 7350 2786 4953",
    unit: "Appartement 2",
    ingang_datum: "2018-11-01",
    uitgang_datum: "2020-12-31",
  },
  {
    voornaam: "Nele",
    naam: "Driesen",
    iban: "BE82 0015 5243 3668",
    unit: "Appartement 1",
    ingang_datum: "2019-12-01",
    uitgang_datum: "2022-11-30",
  },
];

// --- correcties op bestaande huurders (placeholder 2020-01-01 klopt niet) --
const FIX = [
  { match: { voornaam: "Wesley", naam: "Stevens" }, set: { ingang_datum: "2021-01-01" } },
  { match: { voornaam: "Mandy", naam: "Machiels" }, set: { ingang_datum: "2022-12-01" } },
  { match: { voornaam: "Jo", naam: "Vrancken" }, set: { ingang_datum: "2018-11-01" } },
  { match: { voornaam: "Patrick", naam: "Croughs" }, set: { ingang_datum: "2018-11-01" } },
];

const { data: huurders } = await db
  .from("huurder")
  .select("id, voornaam, naam, iban, unit_id, ingang_datum, uitgang_datum")
  .in("unit_id", Object.values(U));

console.log("== NIEUWE HUURDERS ==");
const teMaken = [];
for (const h of NIEUW) {
  const bestaat = huurders.find(
    (x) => nz(x.iban) === nz(h.iban) || (x.voornaam === h.voornaam && x.naam === h.naam),
  );
  if (bestaat) {
    console.log(`  ${h.voornaam} ${h.naam}: bestaat al — overslaan`);
    continue;
  }
  console.log(
    `  ${h.voornaam} ${h.naam}  ${h.iban}  ${h.unit}  ${h.ingang_datum} → ${h.uitgang_datum}`,
  );
  teMaken.push({
    unit_id: U[h.unit],
    voornaam: h.voornaam,
    naam: h.naam,
    iban: h.iban,
    ingang_datum: h.ingang_datum,
    uitgang_datum: h.uitgang_datum,
  });
}

console.log("\n== CORRECTIES BESTAANDE HUURDERS ==");
const teFixen = [];
for (const f of FIX) {
  const h = huurders.find(
    (x) => x.voornaam === f.match.voornaam && x.naam === f.match.naam,
  );
  if (!h) {
    console.log(`  ${f.match.voornaam} ${f.match.naam}: niet gevonden`);
    continue;
  }
  const veld = Object.keys(f.set)[0];
  if (h[veld] === f.set[veld]) {
    console.log(`  ${h.voornaam} ${h.naam}: ${veld} al ${f.set[veld]}`);
    continue;
  }
  console.log(`  ${h.voornaam} ${h.naam}: ${veld} ${h[veld]} → ${f.set[veld]}`);
  teFixen.push({ id: h.id, set: f.set });
}

// --- transactie ↔ unit koppelen op IBAN ---------------------------------
console.log("\n== TRANSACTIES KOPPELEN OP IBAN ==");
const alleIbans = [
  ...NIEUW.map((h) => ({ iban: h.iban, unit_id: U[h.unit] })),
  ...huurders.map((h) => ({ iban: h.iban, unit_id: h.unit_id })),
];
const { data: losse } = await db
  .from("transactie")
  .select("id, tegenpartij_iban, bedrag, datum")
  .eq("vme_id", vme.id)
  .is("gematchte_unit_id", null)
  .gt("bedrag", 0);
const koppelingen = [];
for (const t of losse ?? []) {
  const hit = alleIbans.find((x) => nz(x.iban) === nz(t.tegenpartij_iban));
  if (hit) koppelingen.push({ id: t.id, unit_id: hit.unit_id });
}
console.log(`  ${koppelingen.length} losse inkomende verrichtingen te koppelen`);

if (!APPLY) {
  console.log("\nDry-run. Draai met --apply om te schrijven.");
  process.exit(0);
}

if (teMaken.length) {
  const { error } = await db.from("huurder").insert(teMaken);
  if (error) throw error;
}
for (const f of teFixen) {
  const { error } = await db.from("huurder").update(f.set).eq("id", f.id);
  if (error) throw error;
}
for (const k of koppelingen) {
  const { error } = await db
    .from("transactie")
    .update({
      gematchte_unit_id: k.unit_id,
      betaler_type: "huurder",
      match_type: "automatisch",
    })
    .eq("id", k.id);
  if (error) throw error;
}
console.log("\nKlaar ✅");
