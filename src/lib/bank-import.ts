import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTx } from "@/lib/bank-parse";
import {
  classificeer,
  GEEN_MATCH_NODIG,
  type ClassifyContext,
} from "@/lib/bank-classify";
import type { VmeRekening } from "@/lib/types";

export interface ImportRow extends ParsedTx {
  mandaatreferte?: string | null;
  /** Rekening per rij (KBC-CSV bevat meerdere rekeningen); anders de default. */
  rekening?: VmeRekening | null;
}

export interface TransactieInsert {
  vme_id: string;
  datum: string;
  bedrag: number;
  tegenpartij_naam: string | null;
  tegenpartij_iban: string | null;
  mededeling: string | null;
  bron: "xls" | "pdf";
  rekening: VmeRekening | null;
  soort: string;
  import_hash: string;
  gematchte_unit_id: string | null;
  betaler_type: string | null;
  match_type: string;
}

export interface ImportVoorbereiding {
  nieuw: TransactieInsert[];
  /** Al aanwezig (zelfde hash of — bij dedupeOpInhoud — zelfde rekening/datum/bedrag). */
  duplicaten: number;
  /** Auto-geclassificeerd */
  automatisch: number;
  /** Echt nog te bekijken (niet-kost, niet-intern, niet gematcht). */
  teControleren: number;
}

async function classifyContext(
  db: SupabaseClient,
  vmeId: string,
  rekening: VmeRekening | null,
): Promise<ClassifyContext> {
  const { data: vme } = await db
    .from("vme")
    .select("iban, iban_reserve")
    .eq("id", vmeId)
    .maybeSingle<{ iban: string | null; iban_reserve: string | null }>();

  const { data: units } = await db.from("unit").select("id").eq("vme_id", vmeId);
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);

  const [{ data: eigenaars }, { data: huurders }, { data: relaties }] =
    await Promise.all([
      unitIds.length
        ? db.from("eigenaar").select("unit_id, iban").in("unit_id", unitIds)
        : Promise.resolve({ data: [] }),
      unitIds.length
        ? db.from("huurder").select("unit_id, iban").in("unit_id", unitIds)
        : Promise.resolve({ data: [] }),
      db
        .from("bankrelatie")
        .select("iban, type, mandaatreferte, naam_bevat")
        .eq("vme_id", vmeId),
    ]);

  return {
    rekening,
    vmeZichtIban: vme?.iban ?? null,
    vmeSpaarIban: vme?.iban_reserve ?? null,
    owners: (eigenaars ?? []) as { unit_id: string; iban: string | null }[],
    occupants: (huurders ?? []) as { unit_id: string; iban: string | null }[],
    bankrelaties: (relaties ?? []) as ClassifyContext["bankrelaties"],
  };
}

const inhoudSleutel = (
  rekening: string | null,
  datum: string,
  bedrag: number,
) => `${rekening ?? ""}|${datum}|${Number(bedrag).toFixed(2)}`;

/**
 * Filtert duplicaten weg en classificeert de rest. Wordt gedeeld door de
 * import-actie in de app en door import-scripts.
 *
 * `dedupeOpInhoud`: dezelfde verrichting kan eerder via een PDF-uittreksel
 * binnengekomen zijn (andere hash, want andere tekst). Dan tellen we per
 * (rekening, datum, bedrag) hoeveel er al staan en slaan we maximaal zoveel
 * rijen uit het bestand over — twee echte betalingen van hetzelfde bedrag op
 * dezelfde dag blijven zo behouden.
 */
export async function bereidImportVoor(
  db: SupabaseClient,
  vmeId: string,
  rows: ImportRow[],
  opts: {
    bron: "xls" | "pdf";
    rekening: VmeRekening | null;
    dedupeOpInhoud?: boolean;
  },
): Promise<ImportVoorbereiding> {
  const hashes = rows.map((r) => r.import_hash);
  const bekend = new Set<string>();
  for (let i = 0; i < hashes.length; i += 200) {
    const { data } = await db
      .from("transactie")
      .select("import_hash")
      .eq("vme_id", vmeId)
      .in("import_hash", hashes.slice(i, i + 200));
    for (const b of (data ?? []) as { import_hash: string }[])
      bekend.add(b.import_hash);
  }

  // Binnen het bestand zelf: dezelfde hash = dezelfde rij.
  let kandidaten = rows
    .filter((r) => !bekend.has(r.import_hash))
    .filter(
      (r, i, arr) =>
        arr.findIndex((x) => x.import_hash === r.import_hash) === i,
    );

  if (opts.dedupeOpInhoud && kandidaten.length > 0) {
    const datums = kandidaten.map((r) => r.datum).sort();
    const { data: bestaande } = await db
      .from("transactie")
      .select("rekening, datum, bedrag")
      .eq("vme_id", vmeId)
      .gte("datum", datums[0])
      .lte("datum", datums[datums.length - 1]);

    const teller = new Map<string, number>();
    for (const t of (bestaande ?? []) as {
      rekening: string | null;
      datum: string;
      bedrag: number;
    }[]) {
      const k = inhoudSleutel(t.rekening, t.datum, t.bedrag);
      teller.set(k, (teller.get(k) ?? 0) + 1);
    }
    kandidaten = kandidaten.filter((r) => {
      const k = inhoudSleutel(r.rekening ?? opts.rekening, r.datum, r.bedrag);
      const n = teller.get(k) ?? 0;
      if (n > 0) {
        teller.set(k, n - 1);
        return false;
      }
      return true;
    });
  }

  const ctxPerRekening = new Map<string, ClassifyContext>();
  const ctxVoor = async (rek: VmeRekening | null) => {
    const sleutel = rek ?? "";
    let c = ctxPerRekening.get(sleutel);
    if (!c) {
      c = await classifyContext(db, vmeId, rek);
      ctxPerRekening.set(sleutel, c);
    }
    return c;
  };

  const nieuw: TransactieInsert[] = [];
  for (const r of kandidaten) {
    const rekening = r.rekening ?? opts.rekening;
    const c = classificeer(
      {
        bedrag: r.bedrag,
        tegenpartij_naam: r.tegenpartij_naam,
        tegenpartij_iban: r.tegenpartij_iban,
        mededeling: r.mededeling,
        mandaatreferte: r.mandaatreferte ?? null,
      },
      await ctxVoor(rekening),
    );
    nieuw.push({
      vme_id: vmeId,
      datum: r.datum,
      bedrag: r.bedrag,
      tegenpartij_naam: r.tegenpartij_naam,
      tegenpartij_iban: r.tegenpartij_iban,
      mededeling: r.mededeling,
      bron: opts.bron,
      rekening,
      soort: c.soort,
      import_hash: r.import_hash,
      gematchte_unit_id: c.gematchte_unit_id,
      betaler_type: c.betaler_type,
      match_type: c.match_type,
    });
  }

  const geenMatch = new Set<string>(GEEN_MATCH_NODIG);
  return {
    nieuw,
    duplicaten: rows.length - nieuw.length,
    automatisch: nieuw.filter((n) => n.match_type === "automatisch").length,
    teControleren: nieuw.filter(
      (n) => n.match_type === "onbevestigd" && !geenMatch.has(n.soort),
    ).length,
  };
}

export interface UittrekselMeta {
  rekening: VmeRekening;
  bron: "xls" | "pdf";
  periode_van: string;
  periode_tot: string;
  saldo_begin: number | null;
  saldo_eind: number | null;
  aantal: number;
  bestandsnaam: string | null;
}

/**
 * Bewaart periode + saldo voor het dashboard. Overlapt de nieuwe periode met
 * een bestaand uittreksel (bv. de PDF tot eind augustus, nu een CSV tot eind
 * oktober), dan wordt dat uittreksel verlengd i.p.v. een tweede, overlappend
 * uittreksel aan te maken — anders raakt het begin-/eindsaldo van het boekjaar
 * in de war.
 */
export async function bewaarUittreksel(
  db: SupabaseClient,
  vmeId: string,
  m: UittrekselMeta,
): Promise<void> {
  const { data: overlap } = await db
    .from("bankuittreksel")
    .select("id, periode_van, periode_tot, aantal_verrichtingen")
    .eq("vme_id", vmeId)
    .eq("rekening", m.rekening)
    .lte("periode_van", m.periode_tot)
    .gte("periode_tot", m.periode_van)
    .order("periode_tot", { ascending: false })
    .limit(1);

  const bestaand = (overlap ?? [])[0] as
    | { id: string; periode_tot: string; aantal_verrichtingen: number | null }
    | undefined;

  if (!bestaand) {
    await db.from("bankuittreksel").insert({
      vme_id: vmeId,
      rekening: m.rekening,
      bron: m.bron,
      periode_van: m.periode_van,
      periode_tot: m.periode_tot,
      saldo_begin: m.saldo_begin,
      saldo_eind: m.saldo_eind,
      aantal_verrichtingen: m.aantal,
      bestandsnaam: m.bestandsnaam,
    });
    return;
  }

  // Alles al gedekt, of geen saldo om het eindsaldo bij te werken.
  if (m.periode_tot <= bestaand.periode_tot || m.saldo_eind == null) return;

  await db
    .from("bankuittreksel")
    .update({
      periode_tot: m.periode_tot,
      saldo_eind: m.saldo_eind,
      aantal_verrichtingen: (bestaand.aantal_verrichtingen ?? 0) + m.aantal,
    })
    .eq("id", bestaand.id);
}
