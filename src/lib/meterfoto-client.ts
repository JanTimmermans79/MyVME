/**
 * Browser-only hulpfuncties voor "meterstand via foto":
 *  - opnamedatum uit de EXIF-tags halen;
 *  - meterstand + meternummer uit de foto lezen met lokale OCR (tesseract.js);
 *  - het herkende meternummer matchen aan een bestaande `teller`.
 *
 * OCR van tellers is onbetrouwbaar — de resultaten zijn een *voorstel* dat de
 * gebruiker naast de foto bevestigt of corrigeert. Niets faalt hard.
 *
 * Geen `server-only`: dit draait uitsluitend in de client (canvas, tesseract).
 * De zware modules worden lui geïmporteerd zodat ze niet in de hoofdbundle zitten.
 */

const isoDatum = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** EXIF-opnamedatum → "YYYY-MM-DD"; val terug op de bestandsdatum; anders null. */
export async function leesOpnameDatum(file: File): Promise<string | null> {
  try {
    const mod = await import("exifr");
    const parse = mod.parse ?? mod.default?.parse;
    const out = parse
      ? await parse(file, ["DateTimeOriginal", "CreateDate", "ModifyDate"])
      : null;
    const raw: unknown =
      out?.DateTimeOriginal ?? out?.CreateDate ?? out?.ModifyDate;
    const d = raw instanceof Date ? raw : raw ? new Date(raw as string) : null;
    if (d && !Number.isNaN(d.getTime())) return isoDatum(d);
  } catch {
    /* geen leesbare EXIF */
  }
  if (file.lastModified) {
    const d = new Date(file.lastModified);
    if (!Number.isNaN(d.getTime())) return isoDatum(d);
  }
  return null;
}

export interface OcrResultaat {
  waarde: number | null;
  meternummer: string | null;
  ruweTekst: string;
}

/** Leest de foto met OCR en probeert er een waarde + meternummer uit te halen. */
export async function leesTeller(file: File): Promise<OcrResultaat> {
  try {
    const canvas = await fotoNaarCanvas(file, 1400);
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const { data } = await worker.recognize(canvas);
      const tekst = (data.text ?? "").trim();
      return { ...parseTellertekst(tekst), ruweTekst: tekst };
    } finally {
      await worker.terminate();
    }
  } catch {
    return { waarde: null, meternummer: null, ruweTekst: "" };
  }
}

/** Herkend meternummer → teller.id van dezelfde unit (cijfer-genormaliseerd). */
export function matchTeller(
  meternummer: string | null,
  tellers: { id: string; meternummer: string | null }[],
): string | null {
  if (!meternummer) return null;
  const norm = (s: string) => s.replace(/\D/g, "");
  const doel = norm(meternummer);
  if (doel.length < 4) return null;
  for (const t of tellers) {
    if (!t.meternummer) continue;
    const n = norm(t.meternummer);
    if (n.length >= 4 && (n === doel || doel.includes(n) || n.includes(doel)))
      return t.id;
  }
  return null;
}

// --- intern ---------------------------------------------------------------

async function fotoNaarCanvas(
  file: File,
  maxZijde: number,
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => createImageBitmap(file));
  const schaal = Math.min(
    1,
    maxZijde / Math.max(bitmap.width, bitmap.height || 1),
  );
  const w = Math.max(1, Math.round(bitmap.width * schaal));
  const h = Math.max(1, Math.round(bitmap.height * schaal));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // Grijswaarden + zachte drempel — helpt de OCR op cijferrollen.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = g < 110 ? 0 : g > 160 ? 255 : g;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function parseTellertekst(tekst: string): {
  waarde: number | null;
  meternummer: string | null;
} {
  const upper = tekst.toUpperCase();

  // Meternummer: lange alfanumerieke tokens met minstens 6 cijfers.
  const tokens = upper.match(/\b[A-Z]{0,3}[0-9][0-9A-Z]{5,}\b/g) ?? [];
  const meternummer =
    tokens.find((n) => n.replace(/\D/g, "").length >= 6) ?? null;

  // Waarde: getallen van 1-6 cijfers, evt. met , of . als decimaal.
  const getallen = (tekst.match(/[0-9]{1,6}(?:[.,][0-9]{1,3})?/g) ?? [])
    .map((s) => Number(s.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1_000_000);

  const meterCijfers = meternummer ? meternummer.replace(/\D/g, "") : "";
  const kandidaten = getallen.filter(
    (n) => !meterCijfers || !meterCijfers.includes(String(Math.trunc(n))),
  );
  const bron = kandidaten.length ? kandidaten : getallen;
  const waarde =
    [...bron].sort((a, b) => String(b).length - String(a).length)[0] ?? null;

  return { waarde, meternummer };
}
