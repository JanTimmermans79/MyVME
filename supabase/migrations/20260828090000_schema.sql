-- =============================================================================
-- MyVME - basis datamodel (multi-tenant: meerdere VME's per syndicus)
-- =============================================================================
-- Alle bedragen in EUR, opgeslagen als numeric(14,2) tenzij anders vermeld.
-- Tijdstempels in timestamptz (UTC).
-- =============================================================================

-- gen_random_uuid() zit in Postgres 13+ core; pgcrypto voor de zekerheid.
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- profiles: 1-op-1 met auth.users. is_admin = syndicus.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  volledige_naam text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);
comment on table public.profiles is 'Profiel per auth-gebruiker. is_admin=true => syndicus met volledige toegang.';

-- -----------------------------------------------------------------------------
-- VME (Vereniging van Mede-Eigenaars)
-- -----------------------------------------------------------------------------
create table public.vme (
  id         uuid primary key default gen_random_uuid(),
  naam       text not null,
  adres      text,
  iban       text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- boekjaar
-- -----------------------------------------------------------------------------
create table public.boekjaar (
  id          uuid primary key default gen_random_uuid(),
  vme_id      uuid not null references public.vme(id) on delete cascade,
  start_datum date not null,
  eind_datum  date not null,
  status      text not null default 'open' check (status in ('open','afgesloten')),
  created_at  timestamptz not null default now(),
  check (eind_datum > start_datum)
);
create index boekjaar_vme_idx on public.boekjaar(vme_id);

-- -----------------------------------------------------------------------------
-- unit (kavel / appartement)
-- -----------------------------------------------------------------------------
create table public.unit (
  id         uuid primary key default gen_random_uuid(),
  vme_id     uuid not null references public.vme(id) on delete cascade,
  naam       text not null,               -- bv. "Appartement 2A"
  created_at timestamptz not null default now()
);
create index unit_vme_idx on public.unit(vme_id);

-- -----------------------------------------------------------------------------
-- eigenaar: koppelt een auth-gebruiker aan een unit.
-- Eén gebruiker kan meerdere eigenaar-rijen hebben (meerdere units).
-- -----------------------------------------------------------------------------
create table public.eigenaar (
  id                    uuid primary key default gen_random_uuid(),
  auth_user_id          uuid not null references auth.users(id) on delete cascade,
  unit_id               uuid not null references public.unit(id) on delete cascade,
  naam                  text not null,
  email                 text,
  telefoon              text,
  structuurcode_prefix  text,             -- prefix in gestructureerde mededeling voor bankmatching
  created_at            timestamptz not null default now(),
  unique (auth_user_id, unit_id)
);
create index eigenaar_unit_idx on public.eigenaar(unit_id);
create index eigenaar_user_idx on public.eigenaar(auth_user_id);

-- -----------------------------------------------------------------------------
-- huurder: contactfiche beheerd door de eigenaar. Géén eigen account.
-- -----------------------------------------------------------------------------
create table public.huurder (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.unit(id) on delete cascade,
  naam         text not null,
  email        text,
  telefoon     text,
  ingang_datum date,
  uitgang_datum date,
  created_at   timestamptz not null default now()
);
create index huurder_unit_idx on public.huurder(unit_id);

-- -----------------------------------------------------------------------------
-- verdeelsleutels (flexibel: meerdere sleutels per VME)
-- -----------------------------------------------------------------------------
create table public.verdeelsleutel (
  id         uuid primary key default gen_random_uuid(),
  vme_id     uuid not null references public.vme(id) on delete cascade,
  naam       text not null,               -- bv. "Algemeen", "Lift", "Mazout"
  type       text,
  created_at timestamptz not null default now()
);
create index verdeelsleutel_vme_idx on public.verdeelsleutel(vme_id);

create table public.verdeelsleutel_aandeel (
  verdeelsleutel_id uuid not null references public.verdeelsleutel(id) on delete cascade,
  unit_id           uuid not null references public.unit(id) on delete cascade,
  aandeel           numeric(14,4) not null check (aandeel >= 0),
  primary key (verdeelsleutel_id, unit_id)
);

-- -----------------------------------------------------------------------------
-- kosten
-- -----------------------------------------------------------------------------
create table public.kosten (
  id                uuid primary key default gen_random_uuid(),
  vme_id            uuid not null references public.vme(id) on delete cascade,
  boekjaar_id       uuid not null references public.boekjaar(id) on delete restrict,
  categorie         text not null,
  omschrijving      text,
  bedrag            numeric(14,2) not null,
  datum             date not null,
  leverancier       text,
  document_url      text,               -- pad in storage-bucket 'documenten'
  verdeelsleutel_id uuid references public.verdeelsleutel(id) on delete set null,
  betaler_type      text not null default 'eigenaar' check (betaler_type in ('eigenaar','huurder')),
  bron              text not null default 'manueel' check (bron in ('manueel','ai_voorstel')),
  status            text not null default 'bevestigd' check (status in ('voorstel','bevestigd')),
  created_at        timestamptz not null default now()
);
create index kosten_vme_idx on public.kosten(vme_id);
create index kosten_boekjaar_idx on public.kosten(boekjaar_id);

-- -----------------------------------------------------------------------------
-- mazout_levering
-- -----------------------------------------------------------------------------
create table public.mazout_levering (
  id               uuid primary key default gen_random_uuid(),
  vme_id           uuid not null references public.vme(id) on delete cascade,
  datum            date not null,
  liter            numeric(14,2) not null check (liter > 0),
  prijs_per_liter  numeric(14,4) not null check (prijs_per_liter >= 0),
  leverancier      text,
  created_at       timestamptz not null default now()
);
create index mazout_levering_vme_idx on public.mazout_levering(vme_id);

-- -----------------------------------------------------------------------------
-- verbruik (voor jaar-op-jaar vergelijking, fase 2)
-- -----------------------------------------------------------------------------
create table public.verbruik (
  id          uuid primary key default gen_random_uuid(),
  vme_id      uuid not null references public.vme(id) on delete cascade,
  boekjaar_id uuid not null references public.boekjaar(id) on delete cascade,
  type        text not null check (type in ('mazout','koud_water','warm_water','kuis','verzekering','elektriciteit','overig')),
  waarde      numeric(14,4) not null,
  eenheid     text,
  created_at  timestamptz not null default now()
);
create index verbruik_vme_idx on public.verbruik(vme_id);

-- -----------------------------------------------------------------------------
-- transactie (bank-import: XLS/XLSX hoofdformaat, PDF fallback fase 2)
-- -----------------------------------------------------------------------------
create table public.transactie (
  id                uuid primary key default gen_random_uuid(),
  vme_id            uuid not null references public.vme(id) on delete cascade,
  datum             date not null,
  bedrag            numeric(14,2) not null,
  tegenpartij_naam  text,
  mededeling        text,
  bron              text not null check (bron in ('xls','pdf')),
  import_hash       text not null,        -- dedupe bij her-import
  gematchte_unit_id uuid references public.unit(id) on delete set null,
  betaler_type      text check (betaler_type in ('eigenaar','huurder')),
  match_type        text check (match_type in ('automatisch','manueel','onbevestigd')),
  created_at        timestamptz not null default now(),
  unique (vme_id, import_hash)
);
create index transactie_vme_idx on public.transactie(vme_id);
create index transactie_unit_idx on public.transactie(gematchte_unit_id);

-- -----------------------------------------------------------------------------
-- voorschot (maandelijkse provisie per unit / per betaler_type)
-- -----------------------------------------------------------------------------
create table public.voorschot (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid not null references public.unit(id) on delete cascade,
  betaler_type     text not null check (betaler_type in ('eigenaar','huurder')),
  bedrag_per_maand numeric(14,2) not null check (bedrag_per_maand >= 0),
  ingang_datum     date not null,
  created_at       timestamptz not null default now()
);
create index voorschot_unit_idx on public.voorschot(unit_id);

-- -----------------------------------------------------------------------------
-- afrekening (jaarafrekening per unit / per betaler_type)
-- saldo = ontvangen - verschuldigd  (negatief => bijbetalen, positief => terug)
-- -----------------------------------------------------------------------------
create table public.afrekening (
  id               uuid primary key default gen_random_uuid(),
  boekjaar_id      uuid not null references public.boekjaar(id) on delete cascade,
  unit_id          uuid not null references public.unit(id) on delete cascade,
  betaler_type     text not null check (betaler_type in ('eigenaar','huurder')),
  verschuldigd     numeric(14,2) not null,
  ontvangen        numeric(14,2) not null,
  saldo            numeric(14,2) not null,
  mail_verzonden_op timestamptz,
  mail_status      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (boekjaar_id, unit_id, betaler_type)
);
create index afrekening_unit_idx on public.afrekening(unit_id);
create index afrekening_boekjaar_idx on public.afrekening(boekjaar_id);
