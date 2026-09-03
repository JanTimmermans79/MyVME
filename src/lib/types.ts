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
  // --- VME-gegevens (KBO / juridisch) — allemaal optioneel -------------------
  ondernemingsnummer: string | null;
  rechtsvorm: string | null;
  type_entiteit: string | null;
  kbo_status: string | null;
  rechtstoestand: string | null;
  begindatum: string | null;
  officiele_naam: string | null;
  afkorting: string | null;
  zetel_adres: string | null;
  telefoon: string | null;
  email: string | null;
  webadres: string | null;
  syndicus_naam: string | null;
  syndicus_sinds: string | null;
  created_at: string;
}

/** Optionele VME-gegevens, in de volgorde waarin ze getoond/bewerkt worden. */
export const VME_GEGEVEN_VELDEN = [
  { key: "ondernemingsnummer", label: "Ondernemingsnummer", type: "text" },
  { key: "kbo_status", label: "Status", type: "text" },
  { key: "rechtstoestand", label: "Rechtstoestand", type: "text" },
  { key: "begindatum", label: "Begindatum", type: "date" },
  { key: "officiele_naam", label: "Officiële naam", type: "text" },
  { key: "afkorting", label: "Afkorting", type: "text" },
  { key: "zetel_adres", label: "Adres van de zetel", type: "text" },
  { key: "telefoon", label: "Telefoonnummer", type: "text" },
  { key: "email", label: "E-mail", type: "text" },
  { key: "webadres", label: "Webadres", type: "text" },
  { key: "type_entiteit", label: "Type entiteit", type: "text" },
  { key: "rechtsvorm", label: "Rechtsvorm", type: "text" },
  { key: "syndicus_naam", label: "Syndicus", type: "text" },
  { key: "syndicus_sinds", label: "Syndicus sinds", type: "date" },
] as const satisfies readonly {
  key: keyof Vme;
  label: string;
  type: "text" | "date";
}[];

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
  /** Aandeel in de gemene delen (bv. /1000). Stemgewicht op de AV. */
  quotiteit: number | null;
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
  bedrag: number | null;
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
  | "einde_huurder"
  | "start_huurder"
  | "tussentijds"
  /** @deprecated opgesplitst in einde_huurder + start_huurder */
  | "huurderwissel";

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

/** Compacte huurderinfo voor het eigenaarsoverzicht. */
export interface HuurderInfo {
  id: string;
  naam: string;
  ingang_datum: string | null;
  uitgang_datum: string | null;
}

export type MeteropnameStatus = "nieuw" | "verwerkt" | "afgewezen";
export type MeteropnameRol = "syndicus" | "eigenaar";

export const METEROPNAME_STATUS_LABEL: Record<MeteropnameStatus, string> = {
  nieuw: "In te dienen / na te kijken",
  verwerkt: "Verwerkt",
  afgewezen: "Afgewezen",
};

/** Ingediende tellerfoto (syndicus of eigenaar) met OCR-voorstel. */
export interface Meteropname {
  id: string;
  vme_id: string;
  unit_id: string;
  teller_id: string | null;
  boekjaar_id: string | null;
  document_id: string | null;
  ingediend_door: string | null;
  rol: MeteropnameRol;
  opname_datum: string | null;
  herkende_waarde: number | null;
  herkend_meternummer: string | null;
  waarde: number | null;
  status: MeteropnameStatus;
  meterstand_id: string | null;
  opmerking: string | null;
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
  administratie_pct: number;
  created_at: string;
}

export const EENHEIDSPRIJS_DEFAULTS = {
  prijs_water_per_m3: 6.51,
  mazoutprijs_per_liter: 0.81,
  cv_liter_per_m3: 0.2,
  warmwater_liter_per_m3: 1.0,
  administratie_pct: 0,
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

export type ActiepuntStatus = "open" | "bezig" | "afgewerkt";
export type ActiepuntBron = "handmatig" | "jaarverslag" | "av";

export interface Actiepunt {
  id: string;
  vme_id: string;
  boekjaar_id: string | null;
  titel: string;
  omschrijving: string | null;
  status: ActiepuntStatus;
  deadline: string | null;
  verantwoordelijke: string | null;
  bron: ActiepuntBron;
  document_id: string | null;
  created_at: string;
  afgewerkt_op: string | null;
}

// --- AV (Algemene Vergadering) ---------------------------------------------

export type AvType = "gewoon" | "buitengewoon";
export type AvStatus = "gepland" | "gehouden" | "geannuleerd";
export type AvMeerderheid =
  | "informatief"
  | "volstrekt"
  | "twee_derde"
  | "vier_vijfde"
  | "unaniem";
export type Aanwezigheid = "aanwezig" | "volmacht" | "afwezig";

export const AV_TYPE_LABEL: Record<AvType, string> = {
  gewoon: "Gewone AV",
  buitengewoon: "Buitengewone AV",
};
export const AV_STATUS_LABEL: Record<AvStatus, string> = {
  gepland: "Gepland",
  gehouden: "Gehouden",
  geannuleerd: "Geannuleerd",
};
export const AV_MEERDERHEID_LABEL: Record<AvMeerderheid, string> = {
  informatief: "Informatief (geen stemming)",
  volstrekt: "Volstrekte meerderheid (1/2)",
  twee_derde: "Twee derde (2/3)",
  vier_vijfde: "Vier vijfde (4/5)",
  unaniem: "Unanimiteit",
};
export const AANWEZIGHEID_LABEL: Record<Aanwezigheid, string> = {
  aanwezig: "Aanwezig",
  volmacht: "Volmacht",
  afwezig: "Afwezig",
};

export interface AvVergadering {
  id: string;
  vme_id: string;
  boekjaar_id: string | null;
  datum: string;
  type: AvType;
  locatie: string | null;
  status: AvStatus;
  notulen_document_id: string | null;
  omschrijving: string | null;
  created_at: string;
}

export interface AvAgendapunt {
  id: string;
  av_id: string;
  vme_id: string;
  volgnr: number;
  titel: string;
  toelichting: string | null;
  meerderheid: AvMeerderheid;
  beslissing: string | null;
  stemmen_voor: number | null;
  stemmen_tegen: number | null;
  stemmen_onthouding: number | null;
  aangenomen: boolean | null;
  actiepunt_id: string | null;
  created_at: string;
}

export interface AvAanwezigheid {
  id: string;
  av_id: string;
  vme_id: string;
  unit_id: string;
  aanwezigheid: Aanwezigheid;
  volmacht_naam: string | null;
  created_at: string;
}

// --- Verzekeringen ---------------------------------------------------------

export type PolisType =
  | "brand"
  | "ba_gebouw"
  | "rechtsbijstand"
  | "bestuurdersaansprakelijkheid"
  | "objectieve_aansprakelijkheid"
  | "overig";
export type SchadeStatus =
  | "gemeld"
  | "in_behandeling"
  | "afgehandeld"
  | "geweigerd";

export const POLIS_TYPE_LABEL: Record<PolisType, string> = {
  brand: "Brand",
  ba_gebouw: "BA gebouw",
  rechtsbijstand: "Rechtsbijstand",
  bestuurdersaansprakelijkheid: "Bestuurdersaansprakelijkheid",
  objectieve_aansprakelijkheid: "Objectieve aansprakelijkheid (brand & ontploffing)",
  overig: "Overig",
};
export const SCHADE_STATUS_LABEL: Record<SchadeStatus, string> = {
  gemeld: "Gemeld",
  in_behandeling: "In behandeling",
  afgehandeld: "Afgehandeld",
  geweigerd: "Geweigerd",
};

export interface VerzekeringPolis {
  id: string;
  vme_id: string;
  maatschappij: string;
  polisnummer: string | null;
  type: PolisType;
  jaarpremie: number | null;
  ingang_datum: string | null;
  vervaldatum: string | null;
  hoofdvervaldag: string | null;
  makelaar: string | null;
  document_id: string | null;
  opmerkingen: string | null;
  actief: boolean;
  created_at: string;
}

/** Voorgestelde polisvelden uit een geüpload document (bestandsnaam of AI). */
export interface PolisExtract {
  maatschappij?: string;
  polisnummer?: string;
  type?: PolisType;
  jaarpremie?: number;
  ingang_datum?: string;
  vervaldatum?: string;
  hoofdvervaldag?: string;
  makelaar?: string;
  bron: "ai" | "bestandsnaam" | "geen";
  waarschuwing?: string;
}

export interface VerzekeringSchade {
  id: string;
  vme_id: string;
  polis_id: string;
  unit_id: string | null;
  datum: string;
  omschrijving: string;
  status: SchadeStatus;
  dossiernummer: string | null;
  schadebedrag: number | null;
  uitgekeerd_bedrag: number | null;
  document_id: string | null;
  created_at: string;
}

