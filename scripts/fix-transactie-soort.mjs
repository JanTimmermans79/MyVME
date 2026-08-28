/**
 * Herclassificeert de banktransacties van VME Mooi Zicht die met oudere
 * import-logica als 'overig' bleven maar eigenlijk kosten/kredieten zijn,
 * en zet naam-/mandaatherkenning op Eneco en Watergroep.
 *
 * node scripts/fix-transactie-soort.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(
  new URL("../.env.local", import.meta.url),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: vme } = await db
  .from("vme")
  .select("id")
  .eq("naam", "Mooi Zicht")
  .single();

// 1. naam-/mandaatherkenning op de bankrelaties
await db
  .from("bankrelatie")
  .update({ naam_bevat: "WATERGROEP" })
  .eq("vme_id", vme.id)
  .eq("naam", "Watergroep");
await db
  .from("bankrelatie")
  .update({ naam_bevat: "ENECO BELGIUM", mandaatreferte: "61000001597504" })
  .eq("vme_id", vme.id)
  .eq("naam", "Eneco Belgium Nv");
console.log("bankrelaties Watergroep + Eneco: naam-/mandaatherkenning gezet");

// 2. herclassificeer: alle uitgaande + de gekende kredieten -> 'kost'
const { data: rels } = await db
  .from("bankrelatie")
  .select("iban, mandaatreferte, naam_bevat, type")
  .eq("vme_id", vme.id);
const nz = (s) => (s ? s.replace(/\s+/g, "").toUpperCase() : null);

const { data: txs } = await db
  .from("transactie")
  .select("id, bedrag, tegenpartij_naam, tegenpartij_iban, mededeling, soort")
  .eq("vme_id", vme.id)
  .eq("soort", "overig");

let gewijzigd = 0;
for (const t of txs ?? []) {
  const tI = nz(t.tegenpartij_iban);
  const naam = (t.tegenpartij_naam ?? "").toUpperCase();
  const rel = (rels ?? []).find(
    (r) =>
      (tI && nz(r.iban) === tI) ||
      (r.mandaatreferte && (t.mededeling ?? "").includes(r.mandaatreferte)) ||
      (r.naam_bevat && naam.includes(r.naam_bevat.toUpperCase())),
  );
  if (rel?.type === "leverancier" || t.bedrag < 0) {
    await db.from("transactie").update({ soort: "kost" }).eq("id", t.id);
    gewijzigd += 1;
    console.log(`  -> kost: ${t.tegenpartij_naam} ${t.bedrag}`);
  }
}
console.log(`\n${gewijzigd} transactie(s) op 'kost' gezet.`);
