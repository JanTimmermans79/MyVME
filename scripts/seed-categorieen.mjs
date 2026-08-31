/**
 * Vult public.categorie met de categorieën die al in kosten voorkomen +
 * een standaardset, met een groep-inschatting (verbruik/divers/eigenaar).
 * Idempotent (upsert op vme_id+naam, bestaande groep blijft).
 *
 *   node scripts/seed-categorieen.mjs           (dry-run)
 *   node scripts/seed-categorieen.mjs --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const VERBRUIK = /koud ?water|warm ?water|centrale verwarming|^cv$|mazout|stookolie|verwarming|^gas$/i;
const EIGENAAR = /syndic|verzeker|advocaat|grote werken|gevel|renovat|reservefonds|lift|kapitaal/i;

function groepVoor(naam) {
  if (VERBRUIK.test(naam)) return "verbruik";
  if (EIGENAAR.test(naam)) return "eigenaar";
  return "divers";
}

const STANDAARD = [
  "koud water", "warm water", "centrale verwarming", "mazout",
  "elektriciteit", "schoonmaak", "onderhoud", "administratie",
  "verzekering", "syndicus", "onderhoud lift", "grote werken", "diverse",
];

const { data: vmes } = await db.from("vme").select("id, naam");
const { data: bestaandeCat } = await db.from("categorie").select("vme_id, naam");
const heeft = new Set((bestaandeCat ?? []).map((c) => `${c.vme_id}|${c.naam.toLowerCase()}`));

for (const vme of vmes ?? []) {
  const { data: kosten } = await db
    .from("kosten")
    .select("categorie")
    .eq("vme_id", vme.id);
  const namen = new Set([
    ...STANDAARD,
    ...(kosten ?? []).map((k) => k.categorie).filter(Boolean),
  ]);
  const rijen = [];
  for (const naam of namen) {
    if (heeft.has(`${vme.id}|${naam.toLowerCase()}`)) continue;
    rijen.push({ vme_id: vme.id, naam, groep: groepVoor(naam), actief: true });
  }
  console.log(`${vme.naam}: ${rijen.length} nieuwe categorieën`);
  for (const r of rijen) console.log(`   ${r.naam.padEnd(24)} → ${r.groep}`);
  if (APPLY && rijen.length) {
    const { error } = await db.from("categorie").insert(rijen);
    if (error) throw error;
  }
}
console.log(APPLY ? "\nKlaar ✅" : "\nDry-run. Draai met --apply.");
