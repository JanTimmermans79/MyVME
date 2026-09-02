/**
 * Vult de VME-gegevens (KBO / juridisch) van "Mooi Zicht" in.
 * Vereist migratie 20260901150000_vme_kbo_gegevens.sql.
 *
 *   node scripts/set-mooizicht-vme-gegevens.mjs           (dry-run)
 *   node scripts/set-mooizicht-vme-gegevens.mjs --apply
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

const VME_ID = "c3b2d191-98ae-4bcf-921f-cf21ea7c4d70";
const GEGEVENS = {
  ondernemingsnummer: "0479.495.447",
  kbo_status: "Actief",
  rechtstoestand: "Normale toestand",
  begindatum: "2003-01-06",
  officiele_naam:
    "VERENIGING VAN MEDEEIGENAARS GEBOUW RESIDENTIE MOOI ZICHT TE BORGLONN OORSPRONGSTRAAT 64",
  afkorting: "MOOI ZICHT",
  zetel_adres: "Oorsprongstraat 64, 3840 Tongeren-Borgloon",
  type_entiteit: "Rechtspersoon",
  rechtsvorm: "Vereniging van mede-eigenaars",
  syndicus_naam: "Timmermans, Jan",
  syndicus_sinds: "2022-09-01",
};

const main = async () => {
  const { data: bestaand, error: selErr } = await db
    .from("vme")
    .select("id, naam")
    .eq("id", VME_ID)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!bestaand) throw new Error("VME niet gevonden.");

  console.log(`VME: ${bestaand.naam}`);
  for (const [k, v] of Object.entries(GEGEVENS)) console.log(`  ${k.padEnd(20)} = ${v}`);

  if (!APPLY) {
    console.log("\nDry-run. Draai met --apply.");
    return;
  }
  const { error } = await db.from("vme").update(GEGEVENS).eq("id", VME_ID);
  if (error) throw error;
  console.log("\nOpgeslagen ✅");
};

main();
