/**
 * Basis- en comforttarief voor water (De Watergroep).
 *
 * Het gebouw heeft één aansluiting, dus er is maar één basisvolume. Dat wordt
 * gelijk over de appartementen verdeeld (elk 25 % bij vier appartementen, naar
 * bewoningsdagen bij een huurderwissel). Het individuele verbruik wordt eerst
 * aan het basistarief verrekend tot het aandeel in het basisvolume; wat daarboven
 * gaat, kost het comforttarief.
 *
 * Wie zijn aandeel in het basisvolume niet opgebruikt, laat dat over voor de
 * appartementen die erboven zitten (zoals De Watergroep het op gebouwniveau ook
 * rekent): zo is de som van alle afrekeningen gelijk aan wat het hele gebouw via
 * de tellers bij De Watergroep zou betalen.
 *
 * Bewust zonder "server-only": pure rekenlogica.
 */

export interface WaterTarief {
  /** Basisvolume van de aansluiting voor het hele boekjaar (m³). */
  basisvolume: number;
  /** € per m³ (incl. btw). */
  basisPrijs: number;
  /** € per m³ (incl. btw). */
  comfortPrijs: number;
}

export interface WaterDeel {
  id: string;
  /** Verbruikt water (koud + warm) in m³. */
  m3: number;
  /** Aandeel in het basisvolume (m³). */
  recht: number;
}

export interface WaterToewijzing {
  m3: number;
  recht: number;
  basisM3: number;
  comfortM3: number;
  basisKost: number;
  comfortKost: number;
  totaal: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

type TariefVelden = {
  water_basisvolume_m3?: number | string | null;
  water_basis_per_m3?: number | string | null;
  water_comfort_per_m3?: number | string | null;
};

/** Leest het tarief uit een eenheidsprijs-rij; null = niet ingesteld (vaste prijs). */
export function leesWaterTarief(
  ep: TariefVelden | null | undefined,
): WaterTarief | null {
  if (
    !ep ||
    ep.water_basisvolume_m3 == null ||
    ep.water_basis_per_m3 == null ||
    ep.water_comfort_per_m3 == null
  )
    return null;
  const basisvolume = Number(ep.water_basisvolume_m3);
  const basisPrijs = Number(ep.water_basis_per_m3);
  const comfortPrijs = Number(ep.water_comfort_per_m3);
  if (
    !Number.isFinite(basisvolume) ||
    !Number.isFinite(basisPrijs) ||
    !Number.isFinite(comfortPrijs) ||
    basisvolume < 0 ||
    basisPrijs <= 0 ||
    comfortPrijs <= 0
  )
    return null;
  return { basisvolume, basisPrijs, comfortPrijs };
}

export function verdeelWater(
  delen: WaterDeel[],
  tarief: WaterTarief,
): Map<string, WaterToewijzing> {
  // 1. Elk deel verbruikt eerst binnen zijn eigen aandeel.
  // 2. Wat anderen van hun aandeel overlaten, gaat naar wie erboven zit
  //    (naar verhouding van hun overschot, nooit meer dan dat overschot).
  const overschot = (d: WaterDeel) => Math.max(0, d.m3 - d.recht);
  const overgelaten = delen.reduce(
    (s, d) => s + Math.max(0, d.recht - d.m3),
    0,
  );
  const totaalOverschot = delen.reduce((s, d) => s + overschot(d), 0);
  const dekking =
    totaalOverschot > 0 ? Math.min(1, overgelaten / totaalOverschot) : 0;

  const uit = new Map<string, WaterToewijzing>();
  for (const d of delen) {
    const m3 = round3(Math.max(0, d.m3));
    const basisM3 = round3(Math.min(m3, d.recht) + overschot(d) * dekking);
    const comfortM3 = round3(Math.max(0, m3 - basisM3));
    const basisKost = round2(basisM3 * tarief.basisPrijs);
    const comfortKost = round2(comfortM3 * tarief.comfortPrijs);
    uit.set(d.id, {
      m3,
      recht: round3(d.recht),
      basisM3,
      comfortM3,
      basisKost,
      comfortKost,
      totaal: round2(basisKost + comfortKost),
    });
  }
  return uit;
}
