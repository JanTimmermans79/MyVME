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
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const p = (label, rows) => {
  console.log(`\n=== ${label} (${rows?.length ?? 0}) ===`);
  for (const r of rows ?? []) console.log(JSON.stringify(r));
};

p("vme", (await sb.from("vme").select("id,naam,iban,iban_reserve,aantal_kavels")).data);
p("boekjaar", (await sb.from("boekjaar").select("id,start_datum,eind_datum,status")).data);
p("unit", (await sb.from("unit").select("id,naam")).data);
p(
  "eigenaar",
  (await sb.from("eigenaar").select("id,unit_id,voornaam,naam,email,iban,structuurcode_prefix")).data,
);
p(
  "huurder",
  (await sb.from("huurder").select("id,unit_id,voornaam,naam,email,iban,ingang_datum,uitgang_datum")).data,
);
p("bankrelatie", (await sb.from("bankrelatie").select("*")).data);
p("voorschot_eigenaar", (await sb.from("voorschot_eigenaar").select("*")).data);
p("voorschot_huurder", (await sb.from("voorschot_huurder").select("*")).data);
p("teller", (await sb.from("teller").select("id,unit_id,type")).data);
p("meterstand", (await sb.from("meterstand").select("*")).data);
p("eenheidsprijs", (await sb.from("eenheidsprijs").select("*")).data);
p("transactie", (await sb.from("transactie").select("id,datum,bedrag,tegenpartij_naam,tegenpartij_iban,mededeling,gematchte_unit_id,betaler_type,match_type")).data);
p("kosten", (await sb.from("kosten").select("id,categorie,bedrag,datum,betaler_type,status")).data);
