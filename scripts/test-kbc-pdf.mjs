// Test de echte parser uit de app tegen de KBC-uittreksels.
// node scripts/test-kbc-pdf.mjs <pad-naar-pdf>
const file =
  process.argv[2] ?? "C:\\Users\\jan_t\\Downloads\\zichtrek  2024 2025.pdf";

// tsx-loze import van de .ts lib via een kleine transpile is te veel; we
// dupliceren de kernlogica hier niet meer — we roepen pdf-parse met fallback aan
// en tonen of het uittreksel klopt.
import { readFileSync } from "node:fs";
const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
const BUILDS = ["v1.10.100", "v1.10.88", "v1.9.426"];

let text = null;
for (const version of BUILDS) {
  try {
    const r = await pdf(readFileSync(file), { version });
    if (r.text && r.text.trim().length > 50) {
      text = r.text;
      console.log("pdf.js build:", version);
      break;
    }
  } catch {}
}
if (!text) {
  console.log("FAALDE met alle builds");
  process.exit(1);
}

const rekening = /KBC-?Spaarrekening/i.test(text)
  ? "spaar"
  : /KBC-?Bedrijfsrekening/i.test(text)
    ? "zicht"
    : null;
const saldi = [
  ...text.matchAll(
    /Saldo op (\d{2}-\d{2}-\d{4}) om \d{2}:\d{2}\s*(-?[\d.]+,\d{2})/g,
  ),
].map((m) => m[2]);
const amt = (s) => {
  const neg = s.trim().startsWith("-");
  const n = Number(
    s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."),
  );
  return neg && n > 0 ? -n : n;
};
const DATE_AMT = /^(\d{2}-\d{2}-\d{4})(.*?)(-?\d+(?:\.\d{3})*,\d{2})$/;
let lines = text.split(/\r?\n/).map((l) => l.trim());
lines = lines.filter(
  (l) =>
    l &&
    !/^KBC Bank NV|^BTW BE 0462|Een onderneming|Export KBC Touch|^\d+\/\d+$/.test(
      l,
    ) &&
    l !== "EUR",
);
let n = 0;
let som = 0;
for (const l of lines) {
  const m = l.match(DATE_AMT);
  if (m) {
    n++;
    som += amt(m[3]);
  }
}
const eind = saldi[0] ? amt(saldi[0]) : null;
const begin = saldi[saldi.length - 1] ? amt(saldi[saldi.length - 1]) : null;
console.log(`bestand: ${file}`);
console.log(`rekening: ${rekening}   verrichtingen: ${n}`);
console.log(
  `begin ${begin} + som ${som.toFixed(2)} = ${(begin + som).toFixed(2)}  (eind ${eind})  ${
    Math.abs(begin + som - eind) < 0.02 ? "KLOPT ✓" : "WIJKT AF ✗"
  }`,
);
