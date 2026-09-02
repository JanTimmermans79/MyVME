/**
 * Voegt de KBC Patrimoniumpolis (Kantoren en Buildings) toe aan VME Mooi Zicht:
 *  - uploadt het vervaldagbericht-PDF naar de bucket `documenten`
 *  - maakt een `document`-rij (categorie 'verzekering')
 *  - maakt de `verzekering_polis`-rij, gekoppeld aan dat document
 *
 * Gegevens komen rechtstreeks uit het PDF (polisnr 73129626, vervaldagbericht
 * 09/05/2025, premieperiode 16/06/2025–15/06/2026).
 *
 *   node scripts/import-kbc-patrimoniumpolis.mjs            (dry-run)
 *   node scripts/import-kbc-patrimoniumpolis.mjs --apply
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

const VME = "c3b2d191-98ae-4bcf-921f-cf21ea7c4d70";
const PDF_PATH =
  "C:/Users/jan_t/Downloads/20250616 premie verzekeringen KBC patrimonium en building.pdf";
const BESTANDSNAAM = "20250616 premie verzekeringen KBC patrimonium en building.pdf";

const POLIS = {
  vme_id: VME,
  maatschappij: "KBC Verzekeringen",
  polisnummer: "73129626",
  type: "brand", // Patrimoniumpolis Kantoren en Buildings (gebouwen) + BA gebouw + rechtsbijstand
  jaarpremie: 912.84,
  ingang_datum: "2025-06-16",
  vervaldatum: "2026-06-15",
  hoofdvervaldag: "16 juni",
  makelaar: "Leroi & Partners BV",
  opmerkingen:
    "Patrimoniumpolis Kantoren en Buildings. Vervaldagbericht 09/05/2025, " +
    "premieperiode 16/06/2025–15/06/2026. Premieopdeling (incl. taksen): " +
    "verzekering gebouwen € 868,08 · BA gebouw € 35,38 · rechtsbijstand € 9,38 " +
    "= € 912,84. Ligging risico: Zilverstraat 13A, 3840 Kerniel. " +
    "Gestructureerde mededeling +++450/9181/98319+++. " +
    "Onderschrijvingsindex 833 · vervaldagindex 1048. " +
    "Rekening KBC Verzekeringen BE43 7300 0420 0601.",
};

const main = async () => {
  const bytes = readFileSync(PDF_PATH);
  console.log(`PDF: ${BESTANDSNAAM} (${bytes.length} bytes)`);
  console.log("\nverzekering_polis:");
  for (const [k, v] of Object.entries(POLIS))
    if (k !== "vme_id") console.log(`  ${k.padEnd(14)} = ${v}`);

  const { data: bestaand } = await db
    .from("verzekering_polis")
    .select("id")
    .eq("vme_id", VME)
    .eq("polisnummer", POLIS.polisnummer)
    .maybeSingle();
  if (bestaand) {
    console.log(`\nPolis ${POLIS.polisnummer} bestaat al (${bestaand.id}) — niets te doen.`);
    return;
  }

  if (!APPLY) {
    console.log("\nDry-run. Draai met --apply.");
    return;
  }

  const pad = `${VME}/${crypto.randomUUID()}-${BESTANDSNAAM.replace(/[^\w.\-]+/g, "_")}`;
  const up = await db.storage
    .from("documenten")
    .upload(pad, bytes, { contentType: "application/pdf" });
  if (up.error) throw up.error;

  const { data: doc, error: docErr } = await db
    .from("document")
    .insert({
      vme_id: VME,
      naam: BESTANDSNAAM,
      pad,
      mimetype: "application/pdf",
      grootte: bytes.length,
      categorie: "verzekering",
    })
    .select("id")
    .single();
  if (docErr) throw docErr;

  const { error: polErr } = await db
    .from("verzekering_polis")
    .insert({ ...POLIS, document_id: doc.id });
  if (polErr) throw polErr;

  console.log(`\nKlaar ✅  document ${doc.id} + polis ${POLIS.polisnummer} gekoppeld.`);
};

main();
