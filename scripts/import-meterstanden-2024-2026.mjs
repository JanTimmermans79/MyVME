/**
 * Voegt de door Jan aangeleverde tussentijdse meterstanden (2022-2026) toe.
 *  - de rij "1/03/2024" wordt overgeslagen (afwijkende/dalende waarden)
 *  - exacte duplicaten worden overgeslagen
 *  - een kandidaat die een DALENDE reeks zou maken (t.o.v. de dichtstbijzijnde
 *    bestaande stand ervoor/erna) wordt overgeslagen en gerapporteerd
 *  - CV App 1 op 29/01/2026 en 31/08/2026 staan in de app verwisseld -> rechtgezet
 *  - de foute 'huurderwissel'-tag op 31/08/2026 (App 1) -> 'tussentijds'
 *
 *   node scripts/import-meterstanden-2024-2026.mjs           (dry-run)
 *   node scripts/import-meterstanden-2024-2026.mjs --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const VME = "c3b2d191-98ae-4bcf-921f-cf21ea7c4d70";

// --- Jan's tabellen. CV-kolommen = App 1,2,3,4 ; WW & KW = App 1,3,2,4 --------
const APP = ["Appartement 1", "Appartement 2", "Appartement 3", "Appartement 4"];
const CV_ORDER = [0, 1, 2, 3]; // kolom i -> APP index
const WK_ORDER = [0, 2, 1, 3]; // App 1,3,2,4

const DATA = {
  cv: {
    "2024-02-20": [31749, 51818, 43319, 53837],
    "2024-07-05": [33008, 52622, 43113, 55293],
    "2024-08-30": [33017, 52654, 43119, 55346],
    "2024-10-31": [33241, 52760, 43382, 55705],
    "2025-10-02": [36695, 55214, 46191, 59210],
    "2026-01-29": [39445, 59190, 50237, 64045],
    "2026-02-19": [39795, 59799, 50893, 64723],
    "2026-04-23": [40174, 60637, 51698, 65652],
    "2026-07-06": [40243, 60804, 51799, 65808],
    "2026-08-31": [40243, 60804, 51799, 65808],
  },
  warm_water: {
    "2022-12-28": [192, 340, 400, 301],
    "2023-03-04": [201, 344, 407, 304],
    "2023-10-31": [227, 358, 436, 316],
    "2024-02-20": [239, 364, 457, 319],
    "2024-07-05": [249, 369, 474, 323],
    "2024-08-30": [264, 375, 492, 328],
    "2024-10-31": [272, 378, 503, 330],
    "2025-10-02": [287, 384, 527, 335],
    "2026-01-29": [325, 406, 599, 350],
    "2026-02-19": [327, 408, 605, 351],
    "2026-04-23": [332, 412, 621, 354],
    "2026-07-06": [337, 417, 635, 357],
    "2026-08-31": [338, 419, 644, 359],
  },
  koud_water: {
    "2022-12-28": [278, 597, 459, 426],
    "2023-03-04": [288, 604, 465, 429],
    "2023-10-31": [327, 633, 497, 449],
    "2024-02-20": [342, 644, 515, 456],
    "2024-07-05": [353, 652, 530, 463],
    "2024-08-30": [376, 665, 554, 473],
    "2024-10-31": [388, 672, 567, 478],
    "2025-10-02": [403, 681, 587, 486],
    "2026-01-29": [455, 718, 671, 511],
    "2026-02-19": [456, 721, 676, 513],
    "2026-04-23": [460, 727, 691, 513], // App4: Jan schreef 512 "? zie voorgaande stand" -> 513
    "2026-07-06": [465, 735, 715, 523],
    "2026-08-31": [468, 741, 730, 527],
  },
};

const main = async () => {
  const { data: units } = await db.from("unit").select("id, naam").eq("vme_id", VME);
  const unitId = new Map(units.map((u) => [u.naam, u.id]));
  const { data: tellers } = await db
    .from("teller")
    .select("id, unit_id, type")
    .in("unit_id", units.map((u) => u.id));
  const tellerId = (app, type) =>
    tellers.find((t) => t.unit_id === unitId.get(app) && t.type === type)?.id;

  const { data: bestaand } = await db
    .from("meterstand")
    .select("id, teller_id, datum, waarde, aanleiding, huurder_id")
    .in("teller_id", tellers.map((t) => t.id));
  const perTeller = new Map();
  for (const s of bestaand) {
    const l = perTeller.get(s.teller_id) ?? [];
    l.push({ ...s, waarde: Number(s.waarde) });
    perTeller.set(s.teller_id, l);
  }
  for (const l of perTeller.values()) l.sort((a, b) => a.datum.localeCompare(b.datum));

  const inserts = [];
  const overgeslagen = [];
  const updates = [];

  // --- (1) CV App 1 29/01 <-> 31/08/2026 verwisseld: eerst rechtzetten, zodat
  //          de tussenstanden erna correct getoetst worden -------------------
  const cvA1 = perTeller.get(tellerId("Appartement 1", "cv")) ?? [];
  const jan = cvA1.find((r) => r.datum === "2026-01-29");
  const aug = cvA1.find((r) => r.datum === "2026-08-31");
  if (jan && aug && jan.waarde === 40243 && aug.waarde === 39445) {
    updates.push({ id: jan.id, patch: { waarde: 39445 }, wat: "CV App1 29/01/2026 40243 -> 39445" });
    updates.push({
      id: aug.id,
      patch: { waarde: 40243, aanleiding: "tussentijds", huurder_id: null },
      wat: "CV App1 31/08/2026 39445 -> 40243 + tag tussentijds",
    });
    jan.waarde = 39445;
    aug.waarde = 40243;
    aug.aanleiding = "tussentijds";
  }
  // --- (2) 31/08/2026 App 1 WW/KW: foute huurderwissel-tag -> tussentijds ----
  for (const type of ["warm_water", "koud_water"]) {
    const r = (perTeller.get(tellerId("Appartement 1", type)) ?? []).find(
      (x) => x.datum === "2026-08-31" && x.aanleiding === "huurderwissel",
    );
    if (r) {
      updates.push({
        id: r.id,
        patch: { aanleiding: "tussentijds", huurder_id: null },
        wat: `${type} App1 31/08/2026 -> tag tussentijds`,
      });
      r.aanleiding = "tussentijds";
    }
  }
  // --- (3) App 4 huurderwissel 01/07/2025: standen te hoog t.o.v. Jan's tabel
  //          (60279 > 59210 in okt). Gerecht via lineaire interpolatie tussen
  //          31/10/2024 en 02/10/2025 (243/336 dagen). ----------------------
  const A4_FIX = { cv: 58240, warm_water: 334, koud_water: 484 };
  for (const [type, nieuw] of Object.entries(A4_FIX)) {
    const r = (perTeller.get(tellerId("Appartement 4", type)) ?? []).find(
      (x) => x.datum === "2025-07-01" && x.aanleiding === "huurderwissel",
    );
    if (r && r.waarde !== nieuw) {
      updates.push({
        id: r.id,
        patch: { waarde: nieuw },
        wat: `${type} App4 01/07/2025 ${r.waarde} -> ${nieuw} (interpolatie)`,
      });
      r.waarde = nieuw;
    }
  }
  // --- (4) bekende foutieve cel in Jan's tabel: negeren --------------------
  const NEGEER = new Set(["Appartement 3|cv|2024-02-20"]);

  for (const [type, perDatum] of Object.entries(DATA)) {
    const order = type === "cv" ? CV_ORDER : WK_ORDER;
    for (const [datum, waarden] of Object.entries(perDatum)) {
      waarden.forEach((waarde, kol) => {
        const app = APP[order[kol]];
        if (NEGEER.has(`${app}|${type}|${datum}`)) {
          overgeslagen.push(`NEGEER  ${app} ${type} ${datum}=${waarde} (bekende fout in tabel)`);
          return;
        }
        const tid = tellerId(app, type);
        const reeks = perTeller.get(tid) ?? [];
        const bestaandeStand = reeks.find((r) => r.datum === datum);

        // exacte duplicaat
        if (bestaandeStand && bestaandeStand.waarde === waarde) return;

        // conflict met bestaande stand op zelfde datum
        if (bestaandeStand) {
          overgeslagen.push(
            `CONFLICT ${app} ${type} ${datum}: app=${bestaandeStand.waarde}  tabel=${waarde}  (niet aangepast)`,
          );
          return;
        }

        // monotoon? (t.o.v. dichtstbijzijnde stand ervoor/erna, tussentijds inbegrepen)
        const voor = [...reeks].reverse().find((r) => r.datum < datum);
        const na = reeks.find((r) => r.datum > datum);
        if ((voor && waarde < voor.waarde) || (na && waarde > na.waarde)) {
          overgeslagen.push(
            `DAALT   ${app} ${type} ${datum}=${waarde}  (voor ${voor?.datum}=${voor?.waarde ?? "-"}, na ${na?.datum}=${na?.waarde ?? "-"})`,
          );
          return;
        }

        inserts.push({
          teller_id: tid,
          datum,
          waarde,
          aanleiding: "tussentijds",
          huurder_id: null,
        });
        // in de lokale reeks zetten zodat volgende kandidaten hierop checken
        reeks.push({ datum, waarde });
        reeks.sort((a, b) => a.datum.localeCompare(b.datum));
      });
    }
  }

  console.log(`\n${inserts.length} nieuwe standen`);
  console.log(`${updates.length} correcties:`);
  updates.forEach((u) => console.log("   " + u.wat));
  console.log(`\n${overgeslagen.length} overgeslagen:`);
  overgeslagen.forEach((o) => console.log("   " + o));

  // --- eindcontrole: elke tellerreeks (DB + inserts, na updates) stijgend? --
  const naam = new Map(tellers.map((t) => [t.id, `${units.find((u) => u.id === t.unit_id).naam}|${t.type}`]));
  const eind = new Map();
  for (const [tid, l] of perTeller) eind.set(tid, l.map((r) => ({ datum: r.datum, waarde: r.waarde })));
  for (const ins of inserts) {
    const l = eind.get(ins.teller_id) ?? [];
    l.push({ datum: ins.datum, waarde: ins.waarde });
    eind.set(ins.teller_id, l);
  }
  let fouten = 0;
  for (const [tid, l] of eind) {
    l.sort((a, b) => a.datum.localeCompare(b.datum));
    for (let i = 1; i < l.length; i++)
      if (l[i].waarde < l[i - 1].waarde) {
        fouten++;
        console.log(
          `   ⚠ ${naam.get(tid)}: ${l[i - 1].datum}=${l[i - 1].waarde} -> ${l[i].datum}=${l[i].waarde}`,
        );
      }
  }
  console.log(fouten === 0 ? "\nEindcontrole: alle reeksen stijgend ✅" : `\nEindcontrole: ${fouten} dalende overgang(en) ⚠`);

  if (!APPLY) {
    console.log("\nDry-run. Draai met --apply.");
    return;
  }
  if (inserts.length) {
    const { error } = await db.from("meterstand").insert(inserts);
    if (error) throw error;
  }
  for (const u of updates) {
    const { error } = await db.from("meterstand").update(u.patch).eq("id", u.id);
    if (error) throw error;
  }
  console.log("\nKlaar ✅");
};

main();
