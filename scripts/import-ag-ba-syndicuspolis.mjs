/**
 * Voegt de AG Insurance BA-polis "organen van de mede-eigendom" toe aan VME
 * Mooi Zicht (BA syndicus / raad van mede-eigendom / VME + rechtsbijstand):
 *  - uploadt de gescande bijzondere voorwaarden (toestand 21/04/2017)
 *  - maakt een `document`-rij (categorie 'verzekering')
 *  - maakt de `verzekering_polis`-rij, gekoppeld aan dat document
 *
 * De twee aangeleverde PDF's zijn byte-identiek — één document, twee namen.
 * Jaarpremie = de laatste effectieve betaling aan "FORTIS AG" (€ 151,43 op
 * 23/01/2026); de historiek staat in de opmerkingen.
 *
 *   node scripts/import-ag-ba-syndicuspolis.mjs            (dry-run)
 *   node scripts/import-ag-ba-syndicuspolis.mjs --apply
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
  "C:/Users/jan_t/Downloads/BA syndicus  -Raad medeëigendom  zie mail 06032023 jan.pdf";
const BESTANDSNAAM = "BA syndicus - Raad medeeigendom - AG Insurance (2017).pdf";

const POLIS = {
  vme_id: VME,
  maatschappij: "AG Insurance (Fortis AG)",
  polisnummer: "03/99.588.545/000",
  type: "bestuurdersaansprakelijkheid",
  jaarpremie: 151.43,
  ingang_datum: "2017-03-24",
  vervaldatum: null,
  hoofdvervaldag: "1 januari",
  makelaar: "J.L.C BVBA (Jurgen Lowette)",
  opmerkingen:
    "BA van de organen van de mede-eigendom: VME, raad van mede-eigendom en " +
    "niet-professionele/vrijwillige syndicus, + rechtsbijstand (Providis). " +
    "Bijzondere voorwaarden, toestand 21/04/2017. Forfaitaire jaarpremie toen " +
    "€ 169,34 (uitbating/beroeps-BA € 136,56 + rechtsbijstand € 32,78). " +
    "Kapitalen: uitbating € 1.500.000 · beroeps-BA € 250.000 per schadegeval; " +
    "vrijstelling € 173,53. Makelaar J.L.C BVBA, Broekstraat 17, 3840 Jesseren, " +
    "FSMA 016235A, tel 012 24 10 29, jurgen.lowette@portima.be. " +
    "Jaarlijkse premie betaald aan Fortis AG: € 141,78 (2024) · € 143,86 (2025) " +
    "· € 151,43 (2026). Rekening AG Insurance BE02 1401 2004 4540.",
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
    console.log(`\nPolis ${POLIS.polisnummer} bestaat al (${bestaand.id}).`);
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

  console.log(`\nKlaar ✅  document ${doc.id} + polis ${POLIS.polisnummer}.`);
};

main();
