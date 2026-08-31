/**
 * Zet de App 4-huurderwisselstanden terug op de OFFICIËLE waarden uit Patrick
 * Croughs' eindafrekening (bevestigd met foto's van de meters):
 *   CV 60279 · warm water 340 · koud water 495  op 15/06/2025
 * Mijn eerdere interpolatie (58240 / 334 / 484) was fout — Jan's tabelrij van
 * "02/10/2025" bevatte foutieve App 4-waarden, niet de juni-standen.
 *
 *  - huurderwisselstand: waarde terug + datum 01/07/2025 -> 15/06/2025
 *  - de 3 foute App 4-standen van 02/10/2025 worden verwijderd
 *  - Patrick Croughs uitgang_datum 01/07/2025 -> 15/06/2025
 *
 *   node scripts/fix-app4-croughs-standen.mjs          (dry-run)
 *   node scripts/fix-app4-croughs-standen.mjs --apply
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

const WISSEL = [
  { id: "9e6447e7-bf73-4e80-92a9-a5aa8c8923ea", waarde: 60279 }, // cv
  { id: "fd2489f0-e696-4794-a91a-7b6b4d3aacb5", waarde: 340 }, // warm_water
  { id: "9c2fdee3-86e3-4b7a-9431-6c7fb5455f35", waarde: 495 }, // koud_water
];
const VERWIJDER = [
  "8a509c89-9098-49c8-a6cc-a43bcb45266a", // cv 59210
  "1357f318-7798-4184-8f13-4470829fb314", // warm_water 335
  "bb52309e-77c1-447e-b3df-16415ca4c4db", // koud_water 486
];
const PATRICK = "7bc2cbb2-23e9-4d7b-ae7c-919abd9ffafa";

const main = async () => {
  console.log("Herstellen:");
  for (const w of WISSEL)
    console.log(`  meterstand ${w.id} -> waarde ${w.waarde}, datum 2025-06-15`);
  console.log("Verwijderen (foute App 4-standen 02/10/2025):");
  VERWIJDER.forEach((id) => console.log("  " + id));
  console.log("Patrick Croughs uitgang_datum -> 2025-06-15");

  if (!APPLY) {
    console.log("\nDry-run. Draai met --apply.");
    return;
  }

  for (const w of WISSEL) {
    const { error } = await db
      .from("meterstand")
      .update({ waarde: w.waarde, datum: "2025-06-15" })
      .eq("id", w.id);
    if (error) throw error;
  }
  const { error: delErr } = await db.from("meterstand").delete().in("id", VERWIJDER);
  if (delErr) throw delErr;
  const { error: hErr } = await db
    .from("huurder")
    .update({ uitgang_datum: "2025-06-15" })
    .eq("id", PATRICK);
  if (hErr) throw hErr;

  console.log("\nKlaar ✅");
};

main();
