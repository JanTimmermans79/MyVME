/**
 * Herklasseert de kosten die verkeerd op de huurders staan (categorie "diverse"),
 * zodat de app-data overeenkomt met wat wettelijk aan huurders mag doorgerekend
 * worden en met de historische AV-afrekeningen (bv. AV 21/11/2021: het
 * gevelschilderwerk ging naar de eigenaars, niet de bewoners).
 *
 *  NAAR EIGENAARS  : gevelwerk, EPC, expertise geschil, VME-bankkosten,
 *                    Cera-aandeel, onderneming­sloket, dakherstellingen.
 *  VERWIJDERD      : 3 "AFREK …"-lijnen = terugbetaalde afrekeningsaldi aan
 *                    (ex-)huurders, geen gedeelde kost.
 *  ONGEWIJZIGD     : Ecowater (waterontharder), elektricien (Neven/Bellen),
 *                    ruiming septische put — dat blijft terecht huurderslast.
 *
 *   node scripts/herklasseer-diverse-kosten.mjs            (dry-run)
 *   node scripts/herklasseer-diverse-kosten.mjs --apply
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

// id -> nieuwe waarden (betaler + verdeling altijd; categorie optioneel)
const NAAR_EIGENAARS = {
  "81f2717a-f9aa-4d49-8581-afd19277848d": { categorie: "grote werken", note: "gevelschilderwerk Velkeniers € 6.410,88" },
  "a113f2f2-8173-4b0e-840b-c28f706515c4": { note: "EPC Enermico € 730,57" },
  "9ca6aa09-a1ef-42e9-856c-c84c2341bab0": { note: "Cera-aandeel € 390,00" },
  "4fa630bf-2312-4791-ab7d-358baa03a69f": { categorie: "advocaat", note: "expertise gevelgeschil Gillis € 363,00" },
  "b39cead3-2d57-4c0c-8558-97264976f613": { note: "Liantis ondernemingsloket € 92,50" },
  "980039df-0571-46da-bf0b-b032afc483c4": { note: "KBC/Cera-bijdrage 2018 € 15,00" },
  "8ac118e3-01b0-4e7b-bd94-7d27750741e9": { note: "KBC/Cera-bijdrage 2019 € 17,00" },
  "712157c5-8280-4fec-ab5e-46b79a2902fb": { note: "KBC/Cera-bijdrage 2020 € 21,00" },
  "bc5277cb-99a6-4c65-9461-e4517d9cefb0": { note: "bankkosten VME € 23,25" },
  "4ee707cf-a81a-4156-8211-fea277c4a184": { note: "bankkosten VME € 24,00" },
  "5de93add-c994-493a-9183-457ac6a9ec18": { note: "bankkosten VME € 250,00" },
  "bc80b367-1deb-4e7a-b284-bf6e895f8e94": { note: "bankkosten VME € 24,00" },
  "86b7b18e-074f-455c-a08c-6c76040fa426": { note: "bankkosten VME € 250,00" },
  "036250d9-8ac7-4739-9980-81086565097f": { categorie: "onderhoud", note: "dakdekker Dirk (terugbet. Romain) € 60,00" },
  "c0cbba24-a158-4cde-80bc-1d050a86d64d": { categorie: "onderhoud", note: "dakdekker Dirk (terugbet. Romain) € 20,00" },
  "ced76fde-887b-4994-9c17-0e293acf5aae": { categorie: "onderhoud", note: "pannen terugsteken (terugbet. Romain) € 40,00" },
  "db50ae5a-fab9-4009-a97b-64cb1d389a1b": { categorie: "onderhoud", note: "storm: herstel pannen (terugbet. Romain) € 40,00" },
};

const VERWIJDER = {
  "43ba5226-67ed-49fe-9f9c-1713e9364023": "Croughs Patrick — AFREK 2017+2018 (terugbetaling) € 339,75",
  "93fff85f-ba10-4b9a-af03-d02e3a94cfe7": "Houben Inge — AFREK 2018 (terugbetaling) € 339,28",
  "d9936837-b961-4fd1-ad6f-e40d6c98457d": "Stevens Wesley — AFREK 2023 (terugbetaling) € 994,00",
};

const main = async () => {
  const ids = [...Object.keys(NAAR_EIGENAARS), ...Object.keys(VERWIJDER)];
  const { data: rows } = await db
    .from("kosten")
    .select("id, datum, bedrag, leverancier, categorie, betaler_type, verdeling")
    .in("id", ids);
  const byId = Object.fromEntries((rows ?? []).map((r) => [r.id, r]));

  console.log("=== NAAR EIGENAARS (betaler_type=eigenaar, verdeling=gelijk_eigenaars) ===");
  for (const [id, cfg] of Object.entries(NAAR_EIGENAARS)) {
    const r = byId[id];
    if (!r) { console.log(`  ?? ${id} niet gevonden`); continue; }
    const catTxt = cfg.categorie && cfg.categorie !== r.categorie ? `  categorie ${r.categorie}→${cfg.categorie}` : "";
    console.log(`  ${r.datum} EUR ${Number(r.bedrag).toFixed(2).padStart(9)}  ${r.betaler_type}/${r.verdeling}  →  ${cfg.note}${catTxt}`);
  }
  console.log("\n=== VERWIJDEREN (geen kost — terugbetaling) ===");
  for (const [id, why] of Object.entries(VERWIJDER)) {
    const r = byId[id];
    console.log(`  ${r ? r.datum : "??"}  ${why}`);
  }

  if (!APPLY) { console.log("\nDry-run. Draai met --apply."); return; }

  let n = 0;
  for (const [id, cfg] of Object.entries(NAAR_EIGENAARS)) {
    const patch = { betaler_type: "eigenaar", verdeling: "gelijk_eigenaars" };
    if (cfg.categorie) patch.categorie = cfg.categorie;
    const { error } = await db.from("kosten").update(patch).eq("id", id);
    if (error) throw error;
    n++;
  }
  const { error: delErr } = await db.from("kosten").delete().in("id", Object.keys(VERWIJDER));
  if (delErr) throw delErr;

  console.log(`\n${n} kosten herklasseerd, ${Object.keys(VERWIJDER).length} verwijderd ✅`);
  console.log("Let op: de app-afrekeningen voor 2023-2024 t/m 2025-2026 opnieuw laten berekenen.");
};

main();
