import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

const cijfers = (s: string) => s.replace(/\D/g, "");
const MIN_LENGTE = 3;

/**
 * Vergelijkt een geregistreerd meternummer met de herkende cijfers.
 *  - `exact` (voor "hoort bij een ander appartement" → hard weigeren): enkel
 *    een exacte match telt, zodat een OCR-misser geen upload blokkeert.
 *  - anders (voor "is dit mijn eigen teller?"): ook een deel-match volstaat.
 */
function past(
  meternummer: string | null,
  doelCijfers: string,
  exact: boolean,
): boolean {
  if (!meternummer) return false;
  const c = cijfers(meternummer);
  if (c.length < MIN_LENGTE) return false;
  if (exact) return c === doelCijfers;
  return (
    c === doelCijfers || c.includes(doelCijfers) || doelCijfers.includes(c)
  );
}

export interface TellerControleOpties {
  vmeId: string;
  unitId: string;
  tellerId: string | null;
  herkendMeternummer: string | null;
  bevestigdEigenTeller: boolean;
  rol: "syndicus" | "eigenaar";
}

/**
 * Veiligheidscontrole vóór een `meteropname` bewaard wordt:
 *  1. de gekozen teller moet bij `unitId` horen (hard, beide rollen);
 *  2. een herkend meternummer dat bij een teller van een ánder appartement
 *     hoort → altijd weigeren (hard, beide rollen);
 *  3. een herkend meternummer dat bij géén geregistreerde teller van dit
 *     appartement hoort → de eigenaar moet expliciet bevestigen dat het zijn
 *     teller is (`bevestigdEigenTeller`).
 */
export async function controleerTellerkeuze(
  db: Db,
  o: TellerControleOpties,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: unitRows } = await db
    .from("unit")
    .select("id, naam")
    .eq("vme_id", o.vmeId);
  const unitNaam = new Map(
    (unitRows ?? []).map((u) => [u.id as string, u.naam as string]),
  );
  if (!unitNaam.has(o.unitId))
    return { ok: false, error: "Onbekend appartement." };

  const { data: tellerRows } = await db
    .from("teller")
    .select("id, unit_id, meternummer")
    .in("unit_id", [...unitNaam.keys()]);
  const tellers = (tellerRows ?? []) as {
    id: string;
    unit_id: string;
    meternummer: string | null;
  }[];

  // 1. De gekozen teller moet bij dit appartement horen.
  if (o.tellerId) {
    const t = tellers.find((x) => x.id === o.tellerId);
    if (!t || t.unit_id !== o.unitId)
      return {
        ok: false,
        error: "De gekozen teller hoort niet bij dit appartement.",
      };
  }

  // 2 + 3. Kruiscontrole op het herkende meternummer.
  const doel = o.herkendMeternummer ? cijfers(o.herkendMeternummer) : "";
  if (doel.length >= MIN_LENGTE) {
    const elders = tellers.find(
      (t) => t.unit_id !== o.unitId && past(t.meternummer, doel, true),
    );
    if (elders)
      return {
        ok: false,
        error: `Meternummer ${o.herkendMeternummer} hoort bij ${
          unitNaam.get(elders.unit_id) ?? "een ander appartement"
        }. Je kan enkel de tellers van je eigen appartement indienen.`,
      };

    const eigen = tellers.some(
      (t) => t.unit_id === o.unitId && past(t.meternummer, doel, false),
    );
    if (!eigen && o.rol === "eigenaar" && !o.bevestigdEigenTeller)
      return {
        ok: false,
        error:
          "Het herkende meternummer hoort bij geen enkele geregistreerde teller van je appartement. Bevestig dat dit je eigen teller is, of controleer of je de juiste meter fotografeerde.",
      };
  }

  return { ok: true };
}
