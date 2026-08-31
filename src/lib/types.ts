/**
 * Domeintypes. Handmatig bijgehouden zodat het project zonder Supabase CLI
 * type-safe blijft. Kan later vervangen worden door
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type BetalerType = "eigenaar" | "huurder";
export type BoekjaarStatus = "open" | "afgesloten";
export type KostenBron = "manueel" | "ai_voorstel";
export type KostenStatus = "voorstel" | "bevestigd";
export type KostenVerdeling =
  | "individueel_verbruik"
  | "gelijk_huurders"
  | "per_quotiteit"
  | "gelijk_eigenaars";

export const VERDELING_LABEL: Record<KostenVerdeling, string> = {
  individueel_verbruik: "Individueel verbruik (tellers)",
  gelijk_huurders: "Gelijk over de huurders",
  per_quotiteit: "Per quotiteit (verdeelsleutel)",
  gelijk_eigenaars: "Gelijk over de eigenaars",
};
export type TransactieBron = "xls" | "pdf";
export type MatchType = "automatisch" | "manueel" | "onbevestigd";
export type VmeRekening = "zicht" | "spaar";
export type TransactieSoort =
  | "voorschot"
  | "afrekening"
  | "kost"
  | "interne_overboeking"
  | "kapitaalsoproep"
  | "rente"
  | "terugbetaling"
  | "overig";
export type VerbruikType =
  | "mazout"
  | "koud_water"
  | "warm_water"
  | "kuis"
  | "verzekering"
  | "elektriciteit"
  | "overig";

export interface Profile {
  id: string;
  email: string | null;
  volledige_naam: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Vme {
  id: string;
  naam: string;
  adres: string | null;
  /** Zichtrekening (werkingsrekening): voorschotten van eigenaars/huurders. */
  iban: string | null;
  /** Spaarrekening: reservefonds van de VME. */
  iban_reserve: string | null;
  /** Aantal kavels/appartementen (informatief). */
  aantal_kavels: number | null;
  created_at: string;
}

export interface Boekjaar {
  id: string;
  vme_id: string;
  start_datum: string;
  eind_datum: string;
  status: BoekjaarStatus;
  created_at: string;
}

export interface Unit {
  id: string;
  vme_id: string;
  naam: string;
  created_at: string;
}

export interface Eigenaar {
  id: string;
  auth_user_id: string;
  unit_id: string;
  naam: string;
  voornaam: string | null;
  email: string | null;
  telefoon: string | null;
  iban: string | null;
  structuurcode_prefix: string | null;
  created_at: string;
}

export type BankrelatieType = "leverancier" | "eigen_rekening" | "overig";

export interface Bankrelatie {
  id: string;
  vme_id: string;
  naam: string;
  iban: string;
  type: BankrelatieType;
  standaard_categorie: string | null;
  standaard_verdeelsleutel_id: string | null;
  standaard_betaler_type: BetalerType | null;
  standaard_verdeling: KostenVerdeling | null;
  mandaatreferte: string | null;
  naam_bevat: string | null;
  created_at: string;
}

export interface Huurder {
  id: string;
  unit_id: string;
  naam: string;
  voornaam: string | null;
  email: string | null;
  telefoon: string | null;
  iban: string | null;
  ingang_datum: string | null;
  uitgang_datum: string | null;
  created_at: string;
}

export interface Verdeelsleutel {
  id: string;
  vme_id: string;
  naam: string;
  type: string | null;
  created_at: string;
}

export interface VerdeelsleutelAandeel {
  verdeelsleutel_id: string;
  unit_id: string;
  aandeel: number;
}

export type CategorieGroep = "verbruik" | "divers" | "eigenaar";

export interface Categorie {
  id: string;
  vme_id: string;
  naam: string;
  groep: CategorieGroep;
  actief: boolean;
  created_at: string;
}

export interface Kosten {
  id: string;
  vme_id: string;
  boekjaar_id: string;
  categorie: string;
  rekening: VmeRekening;
  omschrijving: string | null;
  bedrag: number;
  datum: string;
  leverancier: string | null;
  document_url: string | null;
  verdeelsleutel_id: string | null;
  betaler_type: BetalerType;
  verdeling: KostenVerdeling;
  betaald_met_transactie_id: string | null;
  omschrijving_extra: string | null;
  bron: KostenBron;
  status: KostenStatus;
  created_at: string;
}

export interface MazoutLevering {
  id: string;
  vme_id: string;
  datum: string;
  liter: number;
  prijs_per_liter: number;
  leverancier: string | null;
  created_at: string;
}

export interface Verbruik {
  id: string;
  vme_id: string;
  boekjaar_id: string;
  type: VerbruikType;
  waarde: number;
  eenheid: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  vme_id: string;
  boekjaar_id: string | null;
  transactie_id: string | null;
  naam: string;
  pad: string;
  mimetype: string | null;
  grootte: number | null;
  categorie: string | null;
  created_at: string;
}

export interface Bankuittreksel {
  id: string;
  vme_id: string;
  rekening: VmeRekening;
  bron: TransactieBron;
  periode_van: string | null;
  periode_tot: string | null;
  saldo_begin: number | null;
  saldo_eind: number | null;
  aantal_verrichtingen: number;
  bestandsnaam: string | null;
  created_at: string;
}

export interface Transactie {
  id: string;
  vme_id: string;
  datum: string;
  bedrag: number;
  tegenpartij_naam: string | null;
  tegenpartij_iban: string | null;
  mededeling: string | null;
  bron: TransactieBron;
  rekening: VmeRekening | null;
  soort: TransactieSoort;
  boekjaar_id: string | null;
  import_hash: string;
  gematchte_unit_id: string | null;
  betaler_type: BetalerType | null;
  match_type: MatchType | null;
  created_at: string;
}

export interface VoorschotEigenaar {
  id: string;
  unit_id: string;
  boekjaar_id: string;
  bedrag_per_maand: number;
  created_at: string;
}

export interface VoorschotHuurder {
  id: string;
  huurder_id: string;
  boekjaar_id: string;
  bedrag_per_maand: number;
  created_at: string;
}

export type TellerType = "warm_water" | "koud_water" | "cv";
export type MeterstandAanleiding =
  | "boekjaareinde"
  | "huurderwissel"
  | "tussentijds";

export interface Teller {
  id: string;
  unit_id: string;
  type: TellerType;
  meternummer: string | null;
  created_at: string;
}

export interface Meterstand {
  id: string;
  teller_id: string;
  datum: string;
  waarde: number;
  aanleiding: MeterstandAanleiding;
  huurder_id: string | null;
  created_at: string;
}

export interface Eenheidsprijs {
  id: string;
  vme_id: string;
  boekjaar_id: string;
  prijs_water_per_m3: number;
  mazoutprijs_per_liter: number;
  cv_liter_per_m3: number;
  warmwater_liter_per_m3: number;
  created_at: string;
}

export const EENHEIDSPRIJS_DEFAULTS = {
  prijs_water_per_m3: 6.51,
  mazoutprijs_per_liter: 0.81,
  cv_liter_per_m3: 0.2,
  warmwater_liter_per_m3: 1.0,
} as const;

export interface Afrekening {
  id: string;
  boekjaar_id: string;
  unit_id: string;
  huurder_id: string | null;
  betaler_type: BetalerType;
  verschuldigd: number;
  ontvangen: number;
  saldo: number;
  mail_verzonden_op: string | null;
  mail_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface AfrekeningLijn {
  id: string;
  afrekening_id: string;
  soort: string;
  omschrijving: string;
  hoeveelheid: number | null;
  eenheid: string | null;
  eenheidsprijs: number | null;
  bedrag: number;
  created_at: string;
}

