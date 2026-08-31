/**
 * Herklasseert bankrente die als `interne_overboeking` was geboekt.
 * KBC boekt "Creditrente van …" met de eigen rekening als tegenpartij, waardoor
 * de oude classificatie-volgorde (interne-overboeking vóór rente) toesloeg.
 * De classifier is intussen aangepast (rente-check eerst); dit script haalt de
 * bestaande verkeerd geboekte rijen recht.
 *
 *   node scripts/fix-rente-classificatie.mjs            (dry-run)
 *   node scripts/fix-rente-classificatie.mjs --apply
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

const { data: rows, error } = await db
  .from("transactie")
  .select("id, datum, bedrag, rekening, tegenpartij_naam, mededeling, soort")
  .neq("soort", "rente")
  .or("tegenpartij_naam.ilike.%creditrente%,mededeling.ilike.%creditrente%");
if (error) throw error;

console.log(`${rows.length} verkeerd geklasseerde rente-rij(en):`);
for (const r of rows)
  console.log(`   ${r.datum}  ${String(r.bedrag).padStart(9)}  ${r.rekening}  ${r.soort} → rente`);

if (APPLY && rows.length) {
  const { error: upErr } = await db
    .from("transactie")
    .update({ soort: "rente", match_type: "automatisch" })
    .in("id", rows.map((r) => r.id));
  if (upErr) throw upErr;
  console.log("\nBijgewerkt ✅");
} else {
  console.log(APPLY ? "\nNiets te doen." : "\nDry-run. Draai met --apply.");
}
