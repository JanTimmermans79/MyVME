import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export interface BoekjaarHuurder {
  id: string;
  unit_id: string;
  unit_naam: string;
  naam: string;
  ingang_datum: string | null;
  uitgang_datum: string | null;
}

/** Huurders met een huurperiode die het boekjaar raakt (ook wie vertrokken is). */
export async function huurdersVanBoekjaar(
  db: Db,
  vmeId: string,
  boekjaar: { start_datum: string; eind_datum: string },
): Promise<BoekjaarHuurder[]> {
  const { data: units } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", vmeId);
  const unitNaam = new Map(
    ((units ?? []) as { id: string; naam: string }[]).map((u) => [u.id, u.naam]),
  );
  if (unitNaam.size === 0) return [];

  const { data } = await db
    .from("huurder")
    .select("id, unit_id, naam, voornaam, ingang_datum, uitgang_datum")
    .in("unit_id", [...unitNaam.keys()]);

  return (
    (data ?? []) as {
      id: string;
      unit_id: string;
      naam: string;
      voornaam: string | null;
      ingang_datum: string | null;
      uitgang_datum: string | null;
    }[]
  )
    .filter(
      (h) =>
        (h.ingang_datum ?? "0000-01-01") <= boekjaar.eind_datum &&
        (h.uitgang_datum ?? "9999-12-31") >= boekjaar.start_datum,
    )
    .map((h) => ({
      id: h.id,
      unit_id: h.unit_id,
      unit_naam: unitNaam.get(h.unit_id) ?? "",
      naam: [h.voornaam, h.naam].filter(Boolean).join(" "),
      ingang_datum: h.ingang_datum,
      uitgang_datum: h.uitgang_datum,
    }))
    .sort(
      (a, b) =>
        a.unit_naam.localeCompare(b.unit_naam) ||
        (a.ingang_datum ?? "").localeCompare(b.ingang_datum ?? ""),
    );
}
