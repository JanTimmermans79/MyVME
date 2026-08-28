/**
 * Diagnose van de Supabase-koppeling. Draaien met:
 *   node scripts/check-supabase.mjs
 * Leest .env.local. Controleert: sleutels werken, tabellen bestaan, RLS staat
 * aan, helper-functies en de storage-bucket bestaan.
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

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SEC = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !PUB || !SEC) {
  console.error("Ontbrekende variabelen in .env.local");
  process.exit(1);
}

const anon = createClient(URL_, PUB, { auth: { persistSession: false } });
const svc = createClient(URL_, SEC, { auth: { persistSession: false } });

let fouten = 0;
const ok = (m) => console.log("  ✔ " + m);
const bad = (m) => {
  console.log("  ✗ " + m);
  fouten++;
};

console.log("URL:", URL_);

console.log("\n[1] Auth bereikbaar");
{
  const { error } = await anon.auth.getSession();
  error ? bad("auth-fout: " + error.message) : ok("auth reageert");
}

const tabellen = [
  "profiles",
  "vme",
  "boekjaar",
  "unit",
  "eigenaar",
  "huurder",
  "verdeelsleutel",
  "verdeelsleutel_aandeel",
  "kosten",
  "mazout_levering",
  "verbruik",
  "voorschot",
  "transactie",
  "afrekening",
];

console.log("\n[2] Tabellen bestaan (service-role)");
for (const t of tabellen) {
  const { error } = await svc.from(t).select("*").limit(1);
  error ? bad(`${t}: ${error.code} ${error.message}`) : ok(t);
}

console.log("\n[3] unit_saldo view");
{
  const { error } = await svc.from("unit_saldo").select("*").limit(1);
  error ? bad(error.message) : ok("unit_saldo");
}

console.log("\n[4] RLS actief (anon mag niet in 'vme' schrijven)");
{
  const { data, error } = await anon.from("vme").insert({ naam: "_probe_" }).select();
  if (error) ok(`geblokkeerd (${error.code})`);
  else {
    bad("anon INSERT lukte — RLS staat NIET aan!");
    if (data?.[0]) await svc.from("vme").delete().eq("id", data[0].id);
  }
}

console.log("\n[5] Helper-functies");
for (const fn of ["is_admin"]) {
  const { error } = await svc.rpc(fn);
  error ? bad(`${fn}(): ${error.message}`) : ok(`${fn}()`);
}

console.log("\n[6] Storage-bucket 'documenten'");
{
  const { data } = await svc.storage.listBuckets();
  (data ?? []).some((b) => b.id === "documenten")
    ? ok("bucket bestaat")
    : bad("bucket ontbreekt — run 20260828090300_storage.sql");
}

console.log(
  fouten === 0
    ? "\nAlles in orde ✅"
    : `\n${fouten} probleem(en) — zie hierboven ❌`,
);
process.exit(fouten === 0 ? 0 : 1);
