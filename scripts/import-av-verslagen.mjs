/**
 * Plaatst de aangeleverde AV-verslagen van Mooi Zicht in de juiste boekjaren:
 *  - uploadt elk bestand naar de bucket `documenten` (categorie 'notulen')
 *  - maakt een `av_vergadering`-rij (datum, type, boekjaar, status 'gehouden')
 *    met het verslag als notulen-document
 *
 * Boekjaar Mooi Zicht loopt 1 nov → 31 okt; het boekjaar wordt uit de datum
 * afgeleid. Idempotent: een AV met dezelfde datum wordt overgeslagen.
 *
 *   node scripts/import-av-verslagen.mjs            (dry-run)
 *   node scripts/import-av-verslagen.mjs --apply
 */
import { readFileSync, existsSync } from "node:fs";
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
const DL = "C:/Users/jan_t/Downloads/";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const VERSLAGEN = [
  {
    datum: "2020-11-24",
    type: "gewoon",
    locatie: "Oorsprongstraat 64, Borgloon",
    bestand: "Mooizicht_AV_20201124.docx",
    naam: "AV 2020-11-24 - jaarvergadering.docx",
    omschrijving:
      "Jaarvergadering boekjaar 2019-2020. Voorzitter Jo Vrancken, syndicus Romain Timmermans. Werkrekening € 1.391,77 → € 1.074,45; reservefonds € 3.366,52 → € 4.319,82.",
  },
  {
    datum: "2021-01-23",
    type: "buitengewoon",
    locatie: "Digitaal",
    bestand: "Mooizicht_AV_20210123.docx",
    naam: "BAV 2021-01-23 - renovatie gevel.docx",
    omschrijving:
      "Renovatie gevel Zilverstraat 13a: offerte schilderwerken Velkeniers weerhouden; anti-vogelstrip Hoebrechts; financiering deels uit reservefonds (€ 2.000 aanhouden) + oproep tekort bij de leden. Varia: Wesley Stevens nieuwe huurder.",
  },
  {
    datum: "2021-11-21",
    type: "gewoon",
    locatie: "Oorsprongstraat 64, Borgloon",
    bestand: "Mooizicht_AV_20211121.docx",
    naam: "AV 2021-11-21 - jaarvergadering.docx",
    omschrijving:
      "Jaarvergadering boekjaar 2020-2021. Kosten toegerekend aan eigenaars € 7.201,55 (o.a. schilderwerken gevel), bewoners € 1.070,46. Werkrekening € 1.074,45 → € 1.884,58; reservefonds € 4.319,82 → € 1.040,35.",
  },
  {
    datum: "2022-05-19",
    type: "buitengewoon",
    locatie: "Oorsprongstraat 64, Borgloon",
    bestand: "Mooizicht_AV_20220519 BAV.docx",
    naam: "BAV 2022-05-19 - vervanging syndicus.docx",
    omschrijving:
      "Vervanging syndicus: Romain Timmermans beëindigt zijn mandaat na de jaarrekening 2022; de VME bereidt de opvolging voor. Schenking appartement rechts beneden aan Jan Timmermans.",
  },
  {
    datum: "2022-09-01",
    type: "buitengewoon",
    locatie: "Oorsprongstraat 64, Borgloon",
    bestand: "Mooizicht_AV_20220901 BAV.docx",
    naam: "BAV 2022-09-01 - aanduiding syndicus Jan Timmermans.docx",
    omschrijving:
      "Aanduiding syndicus: Jan Timmermans met algemeenheid van stemmen benoemd tot (onbezoldigd) syndicus met ingang 1 september 2022; maandelijks kostenforfait € 10/appartement. Bijgestaan door Romain Timmermans.",
  },
  {
    datum: "2023-02-26",
    type: "buitengewoon",
    locatie: "Oorsprongstraat 64, Borgloon",
    bestand: "Mooizicht_AV_20230226 BAV.docx",
    naam: "BAV 2023-02-26 - gevelschade, BA-verzekering syndicus, rekeningmandaten.docx",
    omschrijving:
      "(1) Gevelschade verfwerken Velkeniers — machtiging syndicus tot dossieropvolging (expert, advocaat). (2) Opdracht aan de syndicus tot afsluiten van een BA-verzekering voor zijn werkzaamheden. (3) Handtekeningsbevoegdheid voor de zicht- en spaarrekening aan syndicus Jan Timmermans.",
  },
  {
    datum: "2023-04-20",
    type: "buitengewoon",
    locatie: "Oorsprongstraat 64, Borgloon",
    bestand: "20230420 bijz alg verg  gevelschade.docx",
    naam: "BAV 2023-04-20 - gevelschade Velkeniers.docx",
    omschrijving:
      "Gevelschade: technisch verslag Castermans (expert KBC) — schade door niet-vakkundig uitvoeren van de gevelwerken, niet gedekt door de brandpolis. Ingebrekestelling van Dieter Velkeniers (CVOHA Velkeniers Claessen); bij geen minnelijke schikking naar de vrederechter.",
  },
  {
    datum: "2023-08-29",
    type: "buitengewoon",
    locatie: "Oorsprongstraat 64, Borgloon",
    bestand: "20230830 bijz alg verg.docx",
    naam: "BAV 2023-08-29 - diverse + gevelschadedossier.docx",
    omschrijving:
      "Diverse punten: beschadigde inritpaaltjes (Machiels/Stevens), samenaankoop stookolie, wateroverlast/slokker, defecte garageschakelaar, wespennest. Gevelschadedossier bij advocaat Lauren Vaes + expertise Kantoor Gillis (factuur € 363). Reservefondsbijdrage eigenaars € 50 → € 100/appartement vanaf 1 september 2023.",
  },
  {
    datum: "2024-05-15",
    type: "buitengewoon",
    locatie: "Boomstraat 87, Bommershoven",
    bestand: "Mooizicht_AV_ 20240515 B AV Rev1.pdf",
    naam: "BAV 2024-05-15 - vonnis ondernemingsrechtbank gevelschade.pdf",
    omschrijving:
      "Standpuntbepaling vonnis ondernemingsrechtbank 6/65/2024 (gevelschade schilder Velkeniers CVOHA); beslissing van de leden schriftelijk voor 17/05/2024. Bij beroep: reservefondsprovisie € 100 → € 200/appartement voor advocaten- en herstelkosten. Goedkeuring factuur vervanging garagepoort appartement 1 (Poortservice Marcel).",
  },
];

const boekjaarVoor = (bjen, datum) =>
  bjen.find((b) => b.start_datum <= datum && datum <= b.eind_datum);

const main = async () => {
  const { data: bjen } = await db
    .from("boekjaar")
    .select("id, start_datum, eind_datum")
    .eq("vme_id", VME)
    .order("start_datum");
  const { data: bestaande } = await db
    .from("av_vergadering")
    .select("datum")
    .eq("vme_id", VME);
  const alBekend = new Set((bestaande ?? []).map((r) => r.datum));

  let teDoen = 0;
  for (const v of VERSLAGEN) {
    const bj = boekjaarVoor(bjen, v.datum);
    const pad = DL + v.bestand;
    const bestaat = existsSync(pad);
    const skip = alBekend.has(v.datum);
    console.log(
      `${v.datum}  ${v.type.padEnd(12)} bj ${bj ? `${bj.start_datum}…${bj.eind_datum}` : "??"}  ` +
        `${bestaat ? "" : "BESTAND ONTBREEKT  "}${skip ? "(bestaat al)" : ""}`,
    );
    if (bestaat && !skip && bj) teDoen++;
  }
  console.log(`\n${teDoen} AV('s) toe te voegen.`);

  if (!APPLY) {
    console.log("Dry-run. Draai met --apply.");
    return;
  }

  for (const v of VERSLAGEN) {
    if (alBekend.has(v.datum)) continue;
    const bj = boekjaarVoor(bjen, v.datum);
    const pad = DL + v.bestand;
    if (!bj || !existsSync(pad)) {
      console.log(`overslaan ${v.datum} (geen boekjaar of bestand)`);
      continue;
    }
    const bytes = readFileSync(pad);
    const isPdf = v.bestand.toLowerCase().endsWith(".pdf");
    const storagePad = `${VME}/${crypto.randomUUID()}-${v.naam.replace(/[^\w.\-]+/g, "_")}`;
    const up = await db.storage.from("documenten").upload(storagePad, bytes, {
      contentType: isPdf ? "application/pdf" : DOCX,
    });
    if (up.error) throw up.error;

    const { data: doc, error: docErr } = await db
      .from("document")
      .insert({
        vme_id: VME,
        boekjaar_id: bj.id,
        naam: v.naam,
        pad: storagePad,
        mimetype: isPdf ? "application/pdf" : DOCX,
        grootte: bytes.length,
        categorie: "notulen",
      })
      .select("id")
      .single();
    if (docErr) throw docErr;

    const { error: avErr } = await db.from("av_vergadering").insert({
      vme_id: VME,
      boekjaar_id: bj.id,
      datum: v.datum,
      type: v.type,
      locatie: v.locatie,
      status: "gehouden",
      notulen_document_id: doc.id,
      omschrijving: v.omschrijving,
    });
    if (avErr) throw avErr;
    console.log(`✅ ${v.datum}  ${v.type}  → bj ${bj.start_datum}`);
  }
  console.log("\nKlaar ✅");
};

main();
