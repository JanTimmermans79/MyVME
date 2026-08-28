/**
 * Domeintypes. Handmatig bijgehouden zodat het project zonder Supabase CLI
 * type-safe blijft. Kan later vervangen worden door
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type BetalerType = "eigenaar" | "huurder";
export type BoekjaarStatus = "open" | "afgesloten";
export type KostenBron = "manueel" | "ai_voorstel";
export type KostenStatus = "voorstel" | "bevestigd";
export type TransactieBron = "xls" | "pdf";
export type MatchType = "automatisch" | "manueel" | "onbevestigd";
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

export interface Kosten {
  id: string;
  vme_id: string;
  boekjaar_id: string;
  categorie: string;
  omschrijving: string | null;
  bedrag: number;
  datum: string;
  leverancier: string | null;
  document_url: string | null;
  verdeelsleutel_id: string | null;
  betaler_type: BetalerType;
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

export interface Transactie {
  id: string;
  vme_id: string;
  datum: string;
  bedrag: number;
  tegenpartij_naam: string | null;
  tegenpartij_iban: string | null;
  mededeling: string | null;
  bron: TransactieBron;
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

export interface Afrekening {
  id: string;
  boekjaar_id: string;
  unit_id: string;
  betaler_type: BetalerType;
  verschuldigd: number;
  ontvangen: number;
  saldo: number;
  mail_verzonden_op: string | null;
  mail_status: string | null;
  created_at: string;
  updated_at: string;
}

