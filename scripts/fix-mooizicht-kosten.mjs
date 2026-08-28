/**
 * Eenmalige correctie voor VME Mooi Zicht, boekjaar 2024-2025.
 * - verwijdert de automatisch gegenereerde kosten-voorstellen
 * - boekt schone geaggregeerde kosten volgens de door Jan bevestigde regels
 * - zet de bankrelaties op de juiste categorie + verdeling
 *
 * Draai:  node scripts/fix-mooizicht-kosten.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const { data: vme } = await db
  .from("vme")
  .select("id")
  .eq("naam", "Mooi Zicht")
  .single();
const { data: bj } = await db
  .from("boekjaar")
  .select("id, start_datum, eind_datum")
  .eq("vme_id", vme.id)
  .single();
console.log("VME", vme.id, "boekjaar", bj.start_datum, "->", bj.eind_datum);

// 1. weg met de auto-voorstellen
const del = await db
  .from("kosten")
  .delete()
  .eq("vme_id", vme.id)
  .eq("bron", "ai_voorstel")
  .select("id");
console.log(`Verwijderd: ${del.data?.length ?? 0} auto-kosten`);

// 2. schone geaggregeerde kosten
const eind = bj.eind_datum;
const rows = [
  // --- huurders: gelijk verdeeld, pro rata bewoningsdagen ---
  { categorie: "schoonmaak", omschrijving: "Poetsbeurten (9 betalingen)", bedrag: 520.0, verdeling: "gelijk_huurders", betaler_type: "huurder" },
  { categorie: "elektriciteit", omschrijving: "Elektriciteit gemeenschap (Eneco/ENI, netto na terugbetaling)", bedrag: 788.91, verdeling: "gelijk_huurders", betaler_type: "huurder" },
  { categorie: "diverse", omschrijving: "Diverse: onderhoud ontkalker (Ecowater 253,21), materiaal schoonmaak (155,17), bankkosten KBC (278,50), Alelek (50,23), parking (4,20)", bedrag: 741.31, verdeling: "gelijk_huurders", betaler_type: "huurder" },
  // --- huurders: individueel via de tellers (bedrag is informatief) ---
  { categorie: "koud water", omschrijving: "Watergroep gemeenschap (netto na terugbetaling 325,29)", bedrag: 3570.54, verdeling: "individueel_verbruik", betaler_type: "huurder" },
  { categorie: "mazout", omschrijving: "Mazout (Koen Voets, 2 facturen)", bedrag: 3129.55, verdeling: "individueel_verbruik", betaler_type: "huurder" },
  // --- eigenaars: gelijk over de units ---
  { categorie: "syndicus", omschrijving: "Syndicushonorarium (12 maanden)", bedrag: 480.0, verdeling: "gelijk_eigenaars", betaler_type: "eigenaar" },
  { categorie: "verzekering", omschrijving: "Verzekering (KBC 912,84 + Fortis AG 143,86)", bedrag: 1056.7, verdeling: "gelijk_eigenaars", betaler_type: "eigenaar" },
  { categorie: "advocaat", omschrijving: "Advocaat Lauren Vaes (factuur 2024/076)", bedrag: 1210.0, verdeling: "gelijk_eigenaars", betaler_type: "eigenaar" },
].map((r) => ({
  vme_id: vme.id,
  boekjaar_id: bj.id,
  datum: eind,
  bron: "manueel",
  status: "bevestigd",
  ...r,
}));

const ins = await db.from("kosten").insert(rows).select("id, categorie, bedrag");
if (ins.error) {
  console.error("FOUT bij invoegen:", ins.error.message);
  process.exit(1);
}
console.log(`\nGeboekt: ${ins.data.length} kosten`);
for (const r of rows)
  console.log(`  ${r.categorie.padEnd(14)} ${r.bedrag.toFixed(2).padStart(9)}  ${r.verdeling}`);
const pool = rows
  .filter((r) => r.verdeling === "gelijk_huurders")
  .reduce((s, r) => s + r.bedrag, 0);
console.log(`\n  huurderspool (gelijk_huurders): ${pool.toFixed(2)}`);

// 3. bankrelaties juist zetten
const brFix = [
  ["Eneco Belgium Nv", "elektriciteit", "gelijk_huurders"],
  ["ENI GAS en Power", "elektriciteit", "gelijk_huurders"],
  ["Watergroep", "koud water", "individueel_verbruik"],
  ["Koen Voets", "mazout", "individueel_verbruik"],
  ["Syndicus", "syndicus", "gelijk_eigenaars"],
  ["KBC Verzekeringen", "verzekering", "gelijk_eigenaars"],
  ["Fortis AG", "verzekering", "gelijk_eigenaars"],
  ["ECOWater Systems Europe Nv", "diverse", "gelijk_huurders"],
  ["Vrancken", "schoonmaak", "gelijk_huurders"],
  ["Gevelco", "grote werken", "gelijk_eigenaars"],
  ["Advocaat Lauren Vaes", "advocaat", "gelijk_eigenaars"],
];
for (const [naam, cat, verdeling] of brFix) {
  const betaler =
    verdeling === "gelijk_eigenaars" || verdeling === "per_quotiteit"
      ? "eigenaar"
      : "huurder";
  const r = await db
    .from("bankrelatie")
    .update({
      standaard_categorie: cat,
      standaard_verdeling: verdeling,
      standaard_betaler_type: betaler,
    })
    .eq("vme_id", vme.id)
    .eq("naam", naam)
    .select("id");
  console.log(`  bankrelatie ${naam}: ${r.data?.length ? "ok" : "niet gevonden"}`);
}

console.log("\nKlaar. Draai nu 'Afrekeningen (her)berekenen' in de app.");
