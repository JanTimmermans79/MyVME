/**
 * Splitst de oude 'huurderwissel'-meterstanden op in twee losse gebeurtenissen:
 *   - 'einde_huurder'  (blijft op de rij staan, huurder_id = vertrekker)
 *   - 'start_huurder'  (nieuwe rij, zelfde teller/datum/waarde,
 *                       huurder_id = de opvolgende huurder van die unit)
 *
 * De opvolger = de huurder van dezelfde unit met de kleinste ingang_datum die
 * >= de wisseldatum ligt. Bestaat er al een 'start_huurder' voor die
 * teller + huurder, dan wordt die overgeslagen (idempotent).
 *
 *   node scripts/split-huurderwissel-standen.mjs            (dry-run)
 *   node scripts/split-huurderwissel-standen.mjs --apply
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

const naam = (h) => [h.voornaam, h.naam].filter(Boolean).join(" ");

const main = async () => {
  const [{ data: standen }, { data: tellers }, { data: units }, { data: huurders }] =
    await Promise.all([
      db
        .from("meterstand")
        .select("id, teller_id, datum, waarde, aanleiding, huurder_id")
        .eq("aanleiding", "huurderwissel"),
      db.from("teller").select("id, unit_id, type"),
      db.from("unit").select("id, naam"),
      db
        .from("huurder")
        .select("id, unit_id, naam, voornaam, ingang_datum, uitgang_datum"),
    ]);

  if (!standen || standen.length === 0) {
    console.log("Geen 'huurderwissel'-standen meer — niets te doen.");
    return;
  }

  const tl = Object.fromEntries(tellers.map((t) => [t.id, t]));
  const un = Object.fromEntries(units.map((u) => [u.id, u.naam]));

  const bestaandeStarts = new Set(
    (
      await db
        .from("meterstand")
        .select("teller_id, huurder_id")
        .eq("aanleiding", "start_huurder")
    ).data?.map((r) => `${r.teller_id}|${r.huurder_id}`) ?? [],
  );

  const nieuweRijen = [];
  const teHernoemen = [];

  for (const s of standen) {
    const teller = tl[s.teller_id];
    const unitId = teller.unit_id;
    teHernoemen.push(s.id);

    const opvolger = huurders
      .filter(
        (h) =>
          h.unit_id === unitId &&
          h.id !== s.huurder_id &&
          h.ingang_datum &&
          h.ingang_datum >= s.datum,
      )
      .sort((a, b) => a.ingang_datum.localeCompare(b.ingang_datum))[0];

    const vertrekker = huurders.find((h) => h.id === s.huurder_id);
    console.log(
      `${un[unitId]} ${teller.type} ${s.datum} = ${s.waarde}  ` +
        `einde: ${vertrekker ? naam(vertrekker) : "?"}  →  start: ${
          opvolger ? naam(opvolger) : "(geen opvolger gevonden)"
        }`,
    );

    if (!opvolger) continue;
    if (bestaandeStarts.has(`${s.teller_id}|${opvolger.id}`)) {
      console.log("   · start_huurder bestaat al, overslaan");
      continue;
    }
    nieuweRijen.push({
      teller_id: s.teller_id,
      datum: s.datum,
      waarde: s.waarde,
      aanleiding: "start_huurder",
      huurder_id: opvolger.id,
    });
  }

  console.log(
    `\n${teHernoemen.length} rij(en) → 'einde_huurder', ` +
      `${nieuweRijen.length} nieuwe 'start_huurder'-rij(en).`,
  );

  if (!APPLY) {
    console.log("\nDry-run. Draai met --apply.");
    return;
  }

  const { error: upErr } = await db
    .from("meterstand")
    .update({ aanleiding: "einde_huurder" })
    .in("id", teHernoemen);
  if (upErr) throw upErr;

  if (nieuweRijen.length) {
    const { error: insErr } = await db.from("meterstand").insert(nieuweRijen);
    if (insErr) throw insErr;
  }

  console.log("\nKlaar ✅");
};

main();
