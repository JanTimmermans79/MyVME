/**
 * Voegt voor Mandy Machiels (Appartement 1) de ontbrekende 'einde_huurder'-
 * meterstanden toe op 19/12/2025 met dezelfde waarden als Tony De Vos'
 * 'start_huurder'-stand: koud 454 · warm 324 · cv 38968.
 * Zo krijgt haar eindafrekening 2025-2026 (01/11 – 31/12/2025) het juiste
 * verbruik i.p.v. terug te vallen op de boekjaareinde-stand van 31/10/2025.
 *
 *   node scripts/add-mandy-einde-huurder.mjs           (dry-run)
 *   node scripts/add-mandy-einde-huurder.mjs --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(
  /\r?\n/,
)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MANDY = "25259e96-ad81-4b2c-9c70-a429e8c50739";
const DATUM = "2025-12-19";
const RIJEN = [
  { teller_id: "d1c749ee-3afe-4817-945f-d0933f604c32", type: "koud_water", waarde: 454 },
  { teller_id: "b1ddf0a3-865a-4789-ba72-56ff3821d3a9", type: "warm_water", waarde: 324 },
  { teller_id: "322c578c-48da-45cc-ae6c-ef381ba1ac0c", type: "cv", waarde: 38968 },
];

const main = async () => {
  const { data: bestaand } = await db
    .from("meterstand")
    .select("teller_id")
    .eq("aanleiding", "einde_huurder")
    .eq("huurder_id", MANDY)
    .in("teller_id", RIJEN.map((r) => r.teller_id));
  const heeft = new Set((bestaand ?? []).map((r) => r.teller_id));

  const toevoegen = RIJEN.filter((r) => !heeft.has(r.teller_id)).map((r) => ({
    teller_id: r.teller_id,
    datum: DATUM,
    waarde: r.waarde,
    aanleiding: "einde_huurder",
    huurder_id: MANDY,
  }));

  for (const r of RIJEN)
    console.log(
      `${heeft.has(r.teller_id) ? "bestaat al" : "toevoegen "}  ${r.type.padEnd(11)} = ${r.waarde}  (${DATUM}, einde_huurder, Mandy Machiels)`,
    );

  if (toevoegen.length === 0) {
    console.log("\nNiets te doen.");
    return;
  }
  if (!APPLY) {
    console.log(`\nDry-run — ${toevoegen.length} rij(en). Draai met --apply.`);
    return;
  }
  const { error } = await db.from("meterstand").insert(toevoegen);
  if (error) throw error;
  console.log(`\n${toevoegen.length} meterstand(en) toegevoegd ✅`);
};

main();
