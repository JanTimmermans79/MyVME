/**
 * Eenmalig: historische boekjaren + meterstanden (31/10/2018 t.e.m. 31/10/2023)
 * voor VME Mooi Zicht. Idempotent — bestaande boekjaren/standen worden niet
 * gedupliceerd.
 *
 *   node scripts/import-meterstanden-historiek.mjs         (dry-run)
 *   node scripts/import-meterstanden-historiek.mjs --apply  (schrijft)
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
const APPLY = process.argv.includes("--apply");

// Kolomvolgorde in de bron: App1, App3, App2, App4
const COL = ["Appartement 1", "Appartement 3", "Appartement 2", "Appartement 4"];

const DATA = {
  koud_water: {
    "2018-10-31": [194.14, 444.1, 301.45, 311.41],
    "2019-10-31": [219, 478, 344, 337],
    "2020-10-31": [236.33, 516.2, 391.5, 366.9],
    "2021-10-31": [253.4, 551.9, 422.7, 398.2],
    "2022-10-31": [273, 591, 454, 422],
    "2023-10-31": [327, 633, 497, 449],
  },
  warm_water: {
    "2018-10-31": [142.93, 263.85, 256.24, 234.1],
    "2019-10-31": [155, 279, 287, 250],
    "2020-10-31": [164.69, 297.99, 323.13, 266.05],
    "2021-10-31": [175.7, 318.4, 357.8, 285.2],
    "2022-10-31": [188, 337, 393, 298],
    "2023-10-31": [227, 358, 436, 316],
  },
  cv: {
    "2018-10-31": [10407.5, 16882.5, 23114.4, 21867],
    "2019-10-31": [13145.7, 21695.5, 30373.1, 27132.3],
    "2020-10-31": [16555.1, 25981.8, 38104, 32262],
    "2021-10-31": [21029, 30664, 42400, 39092],
    "2022-10-31": [24969, 34927, 45953, 44121],
    "2023-10-31": [28330, 39435, 49174, 49777],
  },
};

const BOEKJAREN = [
  ["2018-11-01", "2019-10-31"],
  ["2019-11-01", "2020-10-31"],
  ["2020-11-01", "2021-10-31"],
  ["2021-11-01", "2022-10-31"],
  ["2022-11-01", "2023-10-31"],
  ["2023-11-01", "2024-10-31"],
];

const EP_DEFAULT = {
  prijs_water_per_m3: 6.51,
  mazoutprijs_per_liter: 0.81,
  cv_liter_per_m3: 0.2,
  warmwater_liter_per_m3: 1.0,
};

const log = (...a) => console.log(...a);

const { data: vmes } = await db.from("vme").select("id, naam");
const vme = (vmes ?? []).find((v) => v.naam === "Mooi Zicht");
if (!vme) throw new Error("VME 'Mooi Zicht' niet gevonden.");

const { data: units } = await db
  .from("unit")
  .select("id, naam")
  .eq("vme_id", vme.id);
const unitByNaam = new Map((units ?? []).map((u) => [u.naam, u.id]));
for (const n of COL)
  if (!unitByNaam.has(n)) throw new Error(`Unit '${n}' ontbreekt.`);

// --- boekjaren --------------------------------------------------------------
const { data: bestaandeBj } = await db
  .from("boekjaar")
  .select("id, start_datum, eind_datum")
  .eq("vme_id", vme.id);
const bjKey = (s, e) => `${s}|${e}`;
const bjSet = new Set((bestaandeBj ?? []).map((b) => bjKey(b.start_datum, b.eind_datum)));

let bjNieuw = 0;
for (const [s, e] of BOEKJAREN) {
  if (bjSet.has(bjKey(s, e))) {
    log(`boekjaar ${s} – ${e}: bestaat al`);
    continue;
  }
  bjNieuw++;
  log(`boekjaar ${s} – ${e}: AANMAKEN (afgesloten)`);
  if (APPLY) {
    const { data, error } = await db
      .from("boekjaar")
      .insert({ vme_id: vme.id, start_datum: s, eind_datum: e, status: "afgesloten" })
      .select("id")
      .single();
    if (error) throw error;
    if (APPLY) {
      const { error: epErr } = await db
        .from("eenheidsprijs")
        .upsert(
          { vme_id: vme.id, boekjaar_id: data.id, ...EP_DEFAULT },
          { onConflict: "vme_id,boekjaar_id" },
        );
      if (epErr) throw epErr;
    }
  }
}

// --- tellers ---------------------------------------------------------------
const unitIds = COL.map((n) => unitByNaam.get(n));
let { data: tellers } = await db
  .from("teller")
  .select("id, unit_id, type")
  .in("unit_id", unitIds);
tellers = tellers ?? [];
const tellerId = (unitId, type) =>
  tellers.find((t) => t.unit_id === unitId && t.type === type)?.id;

for (const unitId of unitIds)
  for (const type of ["koud_water", "warm_water", "cv"])
    if (!tellerId(unitId, type)) {
      log(`teller ontbreekt: ${unitId} ${type} — AANMAKEN`);
      if (APPLY) {
        const { data, error } = await db
          .from("teller")
          .insert({ unit_id: unitId, type })
          .select("id, unit_id, type")
          .single();
        if (error) throw error;
        tellers.push(data);
      }
    }

// --- meterstanden --------------------------------------------------------
const tIds = tellers.map((t) => t.id);
const { data: bestaand } = await db
  .from("meterstand")
  .select("teller_id, datum")
  .in("teller_id", tIds);
const heeft = new Set((bestaand ?? []).map((m) => `${m.teller_id}|${m.datum}`));

const rijen = [];
for (const [type, perDatum] of Object.entries(DATA)) {
  for (const [datum, waarden] of Object.entries(perDatum)) {
    waarden.forEach((waarde, i) => {
      const unitId = unitByNaam.get(COL[i]);
      const tid = tellerId(unitId, type);
      if (!tid) {
        log(`  ! geen teller voor ${COL[i]} ${type}`);
        return;
      }
      if (heeft.has(`${tid}|${datum}`)) return;
      rijen.push({
        teller_id: tid,
        datum,
        waarde,
        aanleiding: "boekjaareinde",
        huurder_id: null,
      });
    });
  }
}

log(`\nMeterstanden toe te voegen: ${rijen.length} (nieuwe boekjaren: ${bjNieuw})`);
if (!APPLY) {
  log("\nDry-run. Draai met --apply om te schrijven.");
  process.exit(0);
}
if (rijen.length) {
  const { error } = await db.from("meterstand").insert(rijen);
  if (error) throw error;
}
log("Klaar ✅");
