/**
 * Eenmalig: op basis van de geïmporteerde bankverrichtingen
 *  1. de spaarrekening-provisies van Timmermans-Lindelauf aan Appartement 2 koppelen
 *  2. voorschot_huurder + voorschot_eigenaar invullen per boekjaar (modus van de
 *     effectief betaalde maandbedragen), enkel waar er nog geen bedrag staat
 *  3. kosten van de AFGESLOTEN boekjaren automatisch bevestigen (+ ontbrekende
 *     kosten uit de bank aanvullen)
 *
 *   node scripts/import-voorschotten-kosten-historiek.mjs          (dry-run)
 *   node scripts/import-voorschotten-kosten-historiek.mjs --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const nz = (x) => (x ? x.replace(/\s+/g, "").toUpperCase() : null);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const { data: vmes } = await db.from("vme").select("id, naam");
const vme = vmes.find((v) => v.naam === "Mooi Zicht");
const { data: units } = await db.from("unit").select("id, naam").eq("vme_id", vme.id);
const NM = Object.fromEntries(units.map((u) => [u.id, u.naam]));
const UID = Object.fromEntries(units.map((u) => [u.naam, u.id]));
const { data: bj } = await db
  .from("boekjaar")
  .select("id, start_datum, eind_datum, status")
  .eq("vme_id", vme.id)
  .order("start_datum");
const bjFor = (d) => bj.find((b) => d >= b.start_datum && d <= b.eind_datum);
const closedIds = new Set(bj.filter((b) => b.status === "afgesloten").map((b) => b.id));

const { data: huurders } = await db
  .from("huurder")
  .select("id, voornaam, naam, iban, unit_id, ingang_datum, uitgang_datum")
  .in("unit_id", units.map((u) => u.id));

// modus (meest voorkomende maandbedrag), tie -> hoogste
function modus(bedragen) {
  const c = {};
  for (const x of bedragen) c[x] = (c[x] || 0) + 1;
  return Number(
    Object.entries(c).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0],
  );
}

// ---------------------------------------------------------------------------
// 1. Timmermans-Lindelauf (spaar) -> Appartement 2
// ---------------------------------------------------------------------------
const LINDELAUF_IBAN = "BE97735317244649";
const { data: linde } = await db
  .from("transactie")
  .select("id, datum, bedrag, mededeling, gematchte_unit_id")
  .eq("vme_id", vme.id)
  .eq("rekening", "spaar")
  .eq("tegenpartij_iban", LINDELAUF_IBAN)
  .is("gematchte_unit_id", null)
  .gt("bedrag", 0);
console.log(`\n1. Timmermans-Lindelauf -> App 2: ${(linde ?? []).length} verrichtingen`);
if (linde?.length)
  console.log(
    `   ${linde[0].datum} → ${linde[linde.length - 1].datum}, laatste storting: ${
      linde[linde.length - 1].datum
    }`,
  );

// ---------------------------------------------------------------------------
// 2. voorschotten
// ---------------------------------------------------------------------------
// huurder: zicht inkomend soort=voorschot, per huurder(IBAN) per boekjaar
const { data: zi } = await db
  .from("transactie")
  .select("datum, bedrag, tegenpartij_iban")
  .eq("vme_id", vme.id)
  .eq("rekening", "zicht")
  .eq("soort", "voorschot")
  .gt("bedrag", 0);
const vshPer = {}; // huurder_id -> bj_id -> [bedragen]
for (const t of zi ?? []) {
  const b = bjFor(t.datum);
  if (!b) continue;
  const h = huurders.find((x) => nz(x.iban) === nz(t.tegenpartij_iban));
  if (!h) continue;
  ((vshPer[h.id] ??= {})[b.id] ??= []).push(Number(t.bedrag));
}

// eigenaar: spaar inkomend (voorschot), per unit per boekjaar
// + Lindelauf telt mee voor App 2
const { data: sp } = await db
  .from("transactie")
  .select("datum, bedrag, gematchte_unit_id, tegenpartij_iban, mededeling")
  .eq("vme_id", vme.id)
  .eq("rekening", "spaar")
  .gt("bedrag", 0);
const vsePer = {}; // unit_id -> bj_id -> [bedragen]
for (const t of sp ?? []) {
  const b = bjFor(t.datum);
  if (!b) continue;
  if (/gevel|renovatie|kapitaal|oproep|schilderwerken/i.test(t.mededeling ?? "")) continue;
  let unit = t.gematchte_unit_id;
  if (!unit && nz(t.tegenpartij_iban) === LINDELAUF_IBAN) unit = UID["Appartement 2"];
  if (!unit) continue;
  if (Number(t.bedrag) > 400) continue; // eenmalige grote stortingen niet als maandvoorschot
  ((vsePer[unit] ??= {})[b.id] ??= []).push(Number(t.bedrag));
}

const { data: reedsVsh } = await db.from("voorschot_huurder").select("huurder_id, boekjaar_id");
const heeftVsh = new Set((reedsVsh ?? []).map((r) => `${r.huurder_id}|${r.boekjaar_id}`));
const { data: reedsVse } = await db.from("voorschot_eigenaar").select("unit_id, boekjaar_id");
const heeftVse = new Set((reedsVse ?? []).map((r) => `${r.unit_id}|${r.boekjaar_id}`));

const vshRows = [];
console.log("\n2. voorschot_huurder (modus per boekjaar, enkel nieuw):");
for (const [hid, perBj] of Object.entries(vshPer)) {
  const h = huurders.find((x) => x.id === hid);
  for (const [bjid, bedr] of Object.entries(perBj)) {
    if (bedr.length < 2) continue;
    if (heeftVsh.has(`${hid}|${bjid}`)) continue;
    const b = bj.find((x) => x.id === bjid);
    const m = modus(bedr);
    console.log(`   ${(h.voornaam + " " + h.naam).padEnd(22)} ${b.start_datum.slice(0, 4)}-${b.eind_datum.slice(0, 4)}  €${m}/mnd  (${bedr.length} betalingen)`);
    vshRows.push({ huurder_id: hid, boekjaar_id: bjid, bedrag_per_maand: m });
  }
}

const vseRows = [];
console.log("\n   voorschot_eigenaar (modus per boekjaar, enkel nieuw):");
for (const [uid, perBj] of Object.entries(vsePer)) {
  for (const [bjid, bedr] of Object.entries(perBj)) {
    if (bedr.length < 3) continue;
    if (heeftVse.has(`${uid}|${bjid}`)) continue;
    const b = bj.find((x) => x.id === bjid);
    const m = modus(bedr);
    console.log(`   ${NM[uid].padEnd(16)} ${b.start_datum.slice(0, 4)}-${b.eind_datum.slice(0, 4)}  €${m}/mnd  (${bedr.length} betalingen)`);
    vseRows.push({ unit_id: uid, boekjaar_id: bjid, bedrag_per_maand: m });
  }
}

// ---------------------------------------------------------------------------
// 3. kosten van afgesloten boekjaren
// ---------------------------------------------------------------------------
const { data: rel } = await db
  .from("bankrelatie")
  .select("iban, naam, type, mandaatreferte, naam_bevat, standaard_categorie, standaard_verdeling, standaard_verdeelsleutel_id")
  .eq("vme_id", vme.id);
const { data: kostTx } = await db
  .from("transactie")
  .select("id, datum, bedrag, tegenpartij_naam, tegenpartij_iban, mededeling, rekening")
  .eq("vme_id", vme.id)
  .eq("soort", "kost");
const { data: bestaandeKost } = await db
  .from("kosten")
  .select("betaald_met_transactie_id, boekjaar_id, status")
  .eq("vme_id", vme.id);
const gekoppeld = new Set(
  (bestaandeKost ?? []).filter((k) => k.betaald_met_transactie_id).map((k) => k.betaald_met_transactie_id),
);

const KEYW = [
  [/mazout|stookolie|voets/i, "mazout", "gelijk_eigenaars"],
  [/watergroep|water/i, "koud water", "gelijk_eigenaars"],
  [/eneco|eni |elektr|fluvius/i, "elektriciteit", "gelijk_huurders"],
  [/verzeker|kbc verzeker/i, "verzekering", "gelijk_eigenaars"],
  [/syndic/i, "syndicus", "gelijk_eigenaars"],
  [/poets|schoonmaak|kuis|vrancken/i, "schoonmaak", "gelijk_huurders"],
  [/lift|onderhoud lift|coopman|thyssen|kone|schindler/i, "onderhoud lift", "gelijk_eigenaars"],
  [/advocaat|vaes/i, "advocaat", "gelijk_eigenaars"],
  [/gevel|gevelco|renovat/i, "grote werken", "gelijk_eigenaars"],
];
const betalerVoor = (v) =>
  v === "per_quotiteit" || v === "gelijk_eigenaars" ? "eigenaar" : "huurder";

const nieuweKost = [];
for (const t of kostTx ?? []) {
  if (gekoppeld.has(t.id)) continue;
  const b = bjFor(t.datum);
  if (!b || !closedIds.has(b.id)) continue;
  const ti = nz(t.tegenpartij_iban);
  const naam = (t.tegenpartij_naam ?? "").toUpperCase();
  const r = rel.find(
    (x) =>
      (ti && nz(x.iban) === ti) ||
      (x.mandaatreferte && (t.mededeling ?? "").includes(x.mandaatreferte)) ||
      (x.naam_bevat && naam.includes(x.naam_bevat.toUpperCase())),
  );
  let categorie, verdeling, sleutel = null;
  if (r?.standaard_categorie) {
    categorie = r.standaard_categorie;
    verdeling = r.standaard_verdeling ?? "gelijk_huurders";
    sleutel = r.standaard_verdeelsleutel_id ?? null;
  } else {
    const hit = KEYW.find(([re]) => re.test(naam) || re.test(t.mededeling ?? ""));
    categorie = hit ? hit[1] : "diverse";
    // onbekend: spaarrekening -> eigenaarskost, zichtrekening -> exploitatiekost
    verdeling = hit
      ? hit[2]
      : t.rekening === "spaar"
        ? "gelijk_eigenaars"
        : "gelijk_huurders";
  }
  if (Number(t.bedrag) > 0 && verdeling === "individueel_verbruik") verdeling = "gelijk_huurders";
  nieuweKost.push({
    vme_id: vme.id,
    boekjaar_id: b.id,
    categorie,
    bedrag: round2(-Number(t.bedrag)),
    datum: t.datum,
    leverancier: t.tegenpartij_naam,
    verdeelsleutel_id: sleutel,
    verdeling,
    betaler_type: betalerVoor(verdeling),
    betaald_met_transactie_id: t.id,
    bron: "ai_voorstel",
    status: "bevestigd",
  });
}
const teBevestigen = (bestaandeKost ?? []).filter(
  (k) => closedIds.has(k.boekjaar_id) && k.status === "voorstel",
).length;
console.log(`\n3. kosten afgesloten boekjaren: ${teBevestigen} voorstellen bevestigen + ${nieuweKost.length} ontbrekende toevoegen (bevestigd)`);
const catCount = {};
for (const k of nieuweKost) catCount[k.categorie] = (catCount[k.categorie] || 0) + 1;
console.log("   nieuwe kosten per categorie:", JSON.stringify(catCount));

// ---------------------------------------------------------------------------
if (!APPLY) {
  console.log("\nDry-run. Draai met --apply om te schrijven.");
  process.exit(0);
}

if (linde?.length) {
  for (const t of linde) {
    await db
      .from("transactie")
      .update({
        gematchte_unit_id: UID["Appartement 2"],
        betaler_type: "eigenaar",
        soort: "voorschot",
        match_type: "manueel",
      })
      .eq("id", t.id);
  }
}

// Alle spaar-provisies die aan een unit hangen maar nog soort='overig' hebben
// (oude import) -> voorschot; schilderwerken/gevel -> kapitaalsoproep.
{
  const { data: overig } = await db
    .from("transactie")
    .select("id, mededeling")
    .eq("vme_id", vme.id)
    .eq("rekening", "spaar")
    .eq("soort", "overig")
    .gt("bedrag", 0)
    .not("gematchte_unit_id", "is", null);
  for (const t of overig ?? []) {
    const med = t.mededeling ?? "";
    if (/schilderwerk|gevel|renovat|kapitaal|oproep/i.test(med))
      await db.from("transactie").update({ soort: "kapitaalsoproep" }).eq("id", t.id);
    else if (!/correctie/i.test(med))
      await db.from("transactie").update({ soort: "voorschot" }).eq("id", t.id);
  }
}
if (vshRows.length) {
  const { error } = await db.from("voorschot_huurder").upsert(vshRows, {
    onConflict: "huurder_id,boekjaar_id",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}
if (vseRows.length) {
  const { error } = await db.from("voorschot_eigenaar").upsert(vseRows, {
    onConflict: "unit_id,boekjaar_id",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}
if (nieuweKost.length) {
  const { error } = await db.from("kosten").insert(nieuweKost);
  if (error) throw error;
}
{
  const { error } = await db
    .from("kosten")
    .update({ status: "bevestigd" })
    .eq("vme_id", vme.id)
    .in("boekjaar_id", [...closedIds])
    .eq("status", "voorstel");
  if (error) throw error;
}
console.log("\nKlaar ✅");
