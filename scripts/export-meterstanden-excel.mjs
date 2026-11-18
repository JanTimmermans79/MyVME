// Exporteert alle meterstanden naar Excel: één tabblad per appartement,
// kolommen Datum | Stookolie (CV-teller) | Warm water | Koud water.
// Gebruik: node scripts/export-meterstanden-excel.mjs [uitvoerbestand]
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as fs from "node:fs";
XLSX.set_fs(fs);

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const uit = process.argv[2] ?? "exports/meterstanden.xlsx";

const [{ data: units }, { data: tellers }] = await Promise.all([
  sb.from("unit").select("id,naam"),
  sb.from("teller").select("id,unit_id,type"),
]);
const standen = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("meterstand")
    .select("teller_id,datum,waarde")
    .order("datum")
    .range(from, from + 999);
  if (error) throw error;
  standen.push(...data);
  if (data.length < 1000) break;
}

// Vaste volgorde: Links Onder, Links Boven, Rechts Onder, Rechts Boven.
const VOLGORDE = [
  ["LO", "Links Onder"],
  ["LB", "Links Boven"],
  ["RO", "Rechts Onder"],
  ["RB", "Rechts Boven"],
];
const kolomVan = { cv: 1, warm_water: 2, koud_water: 3 };

const wb = XLSX.utils.book_new();
let dubbel = 0;
for (const [code, label] of VOLGORDE) {
  const unit = units.find((u) => u.naam.trim().endsWith(`- ${code}`));
  if (!unit) throw new Error(`Appartement ${code} niet gevonden`);
  const tellerType = new Map(
    tellers.filter((t) => t.unit_id === unit.id).map((t) => [t.id, t.type]),
  );
  const perDatum = new Map();
  for (const s of standen) {
    const type = tellerType.get(s.teller_id);
    if (!type) continue;
    const rij = perDatum.get(s.datum) ?? [null, null, null, null];
    if (rij[kolomVan[type]] != null && rij[kolomVan[type]] !== Number(s.waarde)) dubbel++;
    rij[kolomVan[type]] = Number(s.waarde);
    perDatum.set(s.datum, rij);
  }
  const rijen = [...perDatum.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, r]) => [new Date(`${d}T00:00:00Z`), r[1], r[2], r[3]]);
  const ws = XLSX.utils.aoa_to_sheet(
    [["Datum", "Stookolie", "Warm water", "Koud water"], ...rijen],
    { cellDates: true },
  );
  rijen.forEach((_, i) => {
    ws[`A${i + 2}`].z = "dd/mm/yyyy";
    for (const c of ["B", "C", "D"]) if (ws[`${c}${i + 2}`]) ws[`${c}${i + 2}`].z = "#,##0.000";
  });
  ws["!cols"] = [{ wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, label);
  console.log(`${label}: ${rijen.length} datums`);
}
mkdirSync(dirname(uit), { recursive: true });
XLSX.writeFile(wb, uit, { cellDates: true });
console.log(`Geschreven: ${uit}${dubbel ? ` (let op: ${dubbel} datums met botsende standen, laatste gebruikt)` : ""}`);
