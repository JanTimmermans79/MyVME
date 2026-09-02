-- MyVME - VOLLEDIGE DATABASE-SETUP (voor een LEGE database)

-- >>> supabase/migrations/20260828090000_schema.sql

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
-- EÃ©n gebruiker kan meerdere eigenaar-rijen hebben (meerdere units).
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
-- huurder: contactfiche beheerd door de eigenaar. GÃ©Ã©n eigen account.
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


-- >>> supabase/migrations/20260828090100_functions.sql

-- =============================================================================
-- Helper-functies (voor RLS) + saldo-berekening
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_admin(): is de huidige gebruiker syndicus?
-- SECURITY DEFINER zodat de RLS-policy op profiles zichzelf niet blokkeert.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- -----------------------------------------------------------------------------
-- owns_unit(): is de huidige gebruiker eigenaar van deze unit?
-- -----------------------------------------------------------------------------
create or replace function public.owns_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.eigenaar e
    where e.auth_user_id = auth.uid() and e.unit_id = p_unit_id
  );
$$;

-- -----------------------------------------------------------------------------
-- owns_vme(): heeft de huidige gebruiker minstens Ã©Ã©n unit in deze VME?
-- -----------------------------------------------------------------------------
create or replace function public.owns_vme(p_vme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.eigenaar e
    join public.unit u on u.id = e.unit_id
    where e.auth_user_id = auth.uid() and u.vme_id = p_vme_id
  );
$$;

-- -----------------------------------------------------------------------------
-- bereken_verschuldigd_voorschotten()
-- Cumulatief verschuldigd bedrag aan voorschotten voor een unit/betaler_type,
-- van de eerste ingangsdatum t.e.m. de maand van p_tot.
-- Per maand wordt het op dat moment geldende tarief genomen (laatste voorschot
-- met ingang_datum <= einde van die maand). Geen maand-checklist: dit blijft
-- correct bij vroeg/laat betalen en bij tariefwijzigingen.
-- -----------------------------------------------------------------------------
create or replace function public.bereken_verschuldigd_voorschotten(
  p_unit_id uuid,
  p_betaler_type text,
  p_tot date default current_date
)
returns numeric
language sql
stable
as $$
  with grens as (
    select date_trunc('month', min(v.ingang_datum))::date as eerste
    from public.voorschot v
    where v.unit_id = p_unit_id and v.betaler_type = p_betaler_type
  ),
  maanden as (
    select gs::date as maand
    from grens g
    cross join lateral generate_series(
      g.eerste,
      date_trunc('month', p_tot)::date,
      interval '1 month'
    ) as gs
    where g.eerste is not null
  )
  select coalesce(sum(tarief.bedrag_per_maand), 0)::numeric
  from maanden m
  cross join lateral (
    select v.bedrag_per_maand
    from public.voorschot v
    where v.unit_id = p_unit_id
      and v.betaler_type = p_betaler_type
      and v.ingang_datum <= (m.maand + interval '1 month - 1 day')::date
    order by v.ingang_datum desc
    limit 1
  ) tarief;
$$;

-- -----------------------------------------------------------------------------
-- unit_saldo: Ã©Ã©n lopend saldo per unit / betaler_type.
--   verschuldigd = cumulatieve voorschotten sinds ingangsdatum
--   ontvangen    = som van gematchte banktransacties
--   saldo        = ontvangen - verschuldigd  (negatief => achterstand)
-- security_invoker: de RLS van de opvragende gebruiker is van toepassing.
-- -----------------------------------------------------------------------------
create or replace view public.unit_saldo
with (security_invoker = on) as
select
  u.id                                              as unit_id,
  u.vme_id                                          as vme_id,
  u.naam                                            as unit_naam,
  bt.betaler_type                                   as betaler_type,
  public.bereken_verschuldigd_voorschotten(u.id, bt.betaler_type) as verschuldigd,
  coalesce((
    select sum(t.bedrag)
    from public.transactie t
    where t.gematchte_unit_id = u.id
      and t.betaler_type = bt.betaler_type
  ), 0)                                             as ontvangen,
  coalesce((
    select sum(t.bedrag)
    from public.transactie t
    where t.gematchte_unit_id = u.id
      and t.betaler_type = bt.betaler_type
  ), 0) - public.bereken_verschuldigd_voorschotten(u.id, bt.betaler_type) as saldo
from public.unit u
cross join (values ('eigenaar'::text), ('huurder'::text)) as bt(betaler_type);

-- -----------------------------------------------------------------------------
-- Trigger: profiel automatisch aanmaken bij nieuwe auth-gebruiker.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Trigger: updated_at bijhouden op afrekening.
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists afrekening_touch on public.afrekening;
create trigger afrekening_touch
  before update on public.afrekening
  for each row execute function public.touch_updated_at();


-- >>> supabase/migrations/20260828090200_rls.sql

-- =============================================================================
-- Row Level Security. Verplicht vanaf de eerste migratie.
--
-- Regels:
--   * Syndicus (is_admin() = true): volledige toegang tot alles.
--   * Eigenaar: enkel SELECT op eigen VME/unit-gerelateerde data,
--     UPDATE op het eigen eigenaar-record en op gekoppelde huurders.
--   * Een eigenaar kan nooit data van een andere unit of andere VME opvragen,
--     ook niet via een gemanipuleerde query: elke policy filtert server-side
--     via owns_unit() / owns_vme() op basis van auth.uid().
--   * anon (niet ingelogd): geen enkele policy => geen toegang.
-- =============================================================================

-- Basisrechten: Supabase geeft authenticated/anon standaard DML-grants op nieuwe
-- public tabellen. We zetten ze expliciet en trekken gevoelige kolommen terug.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.unit_saldo to authenticated;

alter table public.profiles              enable row level security;
alter table public.vme                   enable row level security;
alter table public.boekjaar              enable row level security;
alter table public.unit                  enable row level security;
alter table public.eigenaar              enable row level security;
alter table public.huurder               enable row level security;
alter table public.verdeelsleutel        enable row level security;
alter table public.verdeelsleutel_aandeel enable row level security;
alter table public.kosten                enable row level security;
alter table public.mazout_levering       enable row level security;
alter table public.verbruik              enable row level security;
alter table public.transactie            enable row level security;
alter table public.voorschot             enable row level security;
alter table public.afrekening            enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Zelf-promotie tot admin voorkomen: is_admin kan een gewone gebruiker niet wijzigen.
revoke update (is_admin) on public.profiles from authenticated;

-- -----------------------------------------------------------------------------
-- vme
-- -----------------------------------------------------------------------------
create policy vme_admin_all on public.vme
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy vme_select_eigenaar on public.vme
  for select to authenticated using (public.owns_vme(id));

-- -----------------------------------------------------------------------------
-- boekjaar
-- -----------------------------------------------------------------------------
create policy boekjaar_admin_all on public.boekjaar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy boekjaar_select_eigenaar on public.boekjaar
  for select to authenticated using (public.owns_vme(vme_id));

-- -----------------------------------------------------------------------------
-- unit
-- -----------------------------------------------------------------------------
create policy unit_admin_all on public.unit
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy unit_select_eigenaar on public.unit
  for select to authenticated using (public.owns_unit(id));

-- -----------------------------------------------------------------------------
-- eigenaar
--   * eigen record: select + update (maar niet unit_id/auth_user_id/prefix)
-- -----------------------------------------------------------------------------
create policy eigenaar_admin_all on public.eigenaar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy eigenaar_select_own on public.eigenaar
  for select to authenticated using (auth_user_id = auth.uid());
create policy eigenaar_update_own on public.eigenaar
  for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

revoke update (unit_id, auth_user_id, structuurcode_prefix) on public.eigenaar from authenticated;

-- -----------------------------------------------------------------------------
-- huurder: eigenaar mag CRUD op huurders van de eigen unit(s)
-- -----------------------------------------------------------------------------
create policy huurder_admin_all on public.huurder
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy huurder_select_eigenaar on public.huurder
  for select to authenticated using (public.owns_unit(unit_id));
create policy huurder_insert_eigenaar on public.huurder
  for insert to authenticated with check (public.owns_unit(unit_id));
create policy huurder_update_eigenaar on public.huurder
  for update to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy huurder_delete_eigenaar on public.huurder
  for delete to authenticated using (public.owns_unit(unit_id));

-- -----------------------------------------------------------------------------
-- verdeelsleutel + aandeel
-- -----------------------------------------------------------------------------
create policy verdeelsleutel_admin_all on public.verdeelsleutel
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy verdeelsleutel_select_eigenaar on public.verdeelsleutel
  for select to authenticated using (public.owns_vme(vme_id));

create policy vs_aandeel_admin_all on public.verdeelsleutel_aandeel
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy vs_aandeel_select_eigenaar on public.verdeelsleutel_aandeel
  for select to authenticated using (public.owns_unit(unit_id));

-- -----------------------------------------------------------------------------
-- kosten: eigenaar ziet enkel BEVESTIGDE kosten van de eigen VME
-- -----------------------------------------------------------------------------
create policy kosten_admin_all on public.kosten
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy kosten_select_eigenaar on public.kosten
  for select to authenticated using (public.owns_vme(vme_id) and status = 'bevestigd');

-- -----------------------------------------------------------------------------
-- mazout_levering
-- -----------------------------------------------------------------------------
create policy mazout_admin_all on public.mazout_levering
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mazout_select_eigenaar on public.mazout_levering
  for select to authenticated using (public.owns_vme(vme_id));

-- -----------------------------------------------------------------------------
-- verbruik
-- -----------------------------------------------------------------------------
create policy verbruik_admin_all on public.verbruik
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy verbruik_select_eigenaar on public.verbruik
  for select to authenticated using (public.owns_vme(vme_id));

-- -----------------------------------------------------------------------------
-- transactie: eigenaar ziet enkel transacties die aan de eigen unit gematcht zijn
-- -----------------------------------------------------------------------------
create policy transactie_admin_all on public.transactie
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy transactie_select_eigenaar on public.transactie
  for select to authenticated using (gematchte_unit_id is not null and public.owns_unit(gematchte_unit_id));

-- -----------------------------------------------------------------------------
-- voorschot
-- -----------------------------------------------------------------------------
create policy voorschot_admin_all on public.voorschot
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy voorschot_select_eigenaar on public.voorschot
  for select to authenticated using (public.owns_unit(unit_id));

-- -----------------------------------------------------------------------------
-- afrekening
-- -----------------------------------------------------------------------------
create policy afrekening_admin_all on public.afrekening
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy afrekening_select_eigenaar on public.afrekening
  for select to authenticated using (public.owns_unit(unit_id));


-- >>> supabase/migrations/20260828090300_storage.sql

-- =============================================================================
-- Storage: private bucket 'documenten' voor kostenbewijzen / facturen.
-- Eigenaars krijgen gÃ©Ã©n directe leesrechten; de app genereert waar nodig
-- korte-termijn signed URLs (server-side) voor documenten van hun eigen VME.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('documenten', 'documenten', false)
on conflict (id) do nothing;

-- Enkel de syndicus kan objecten in deze bucket lezen/schrijven/verwijderen.
drop policy if exists "documenten_admin_all" on storage.objects;
create policy "documenten_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'documenten' and public.is_admin())
  with check (bucket_id = 'documenten' and public.is_admin());


-- >>> supabase/migrations/20260828100000_vme_bankrekeningen.sql

-- =============================================================================
-- VME: tweede bankrekening (spaarrekening / reservefonds) + aantal kavels
-- =============================================================================
-- Bestaande kolom `vme.iban` = de ZICHTREKENING (werkingsrekening): hierop komen
-- de voorschotten van eigenaars en huurders binnen.
-- Nieuwe kolom `vme.iban_reserve` = de SPAARREKENING: het reservefonds.
-- =============================================================================

alter table public.vme
  add column if not exists iban_reserve  text,
  add column if not exists aantal_kavels integer;

alter table public.vme
  drop constraint if exists vme_aantal_kavels_check;
alter table public.vme
  add constraint vme_aantal_kavels_check
  check (aantal_kavels is null or aantal_kavels >= 0);

comment on column public.vme.iban is
  'Zichtrekening (werkingsrekening): voorschotten van eigenaars/huurders';
comment on column public.vme.iban_reserve is
  'Spaarrekening: reservefonds van de VME';
comment on column public.vme.aantal_kavels is
  'Aantal kavels/appartementen in de VME (informatief)';


-- >>> supabase/migrations/20260828110000_iban_matching.sql

-- =============================================================================
-- Fase 2a: rekeningnummers op huurder/eigenaar + tegenpartij-IBAN op transactie
-- Basis voor IBAN-gebaseerde bankmatching en pro-rata huurdersafrekening.
-- =============================================================================

alter table public.huurder
  add column if not exists voornaam text,
  add column if not exists iban     text;

alter table public.eigenaar
  add column if not exists iban text;

alter table public.transactie
  add column if not exists tegenpartij_iban text;

comment on column public.huurder.voornaam is 'Voornaam van de huurder';
comment on column public.huurder.iban is 'Rekeningnummer van de huurder (bankmatching)';
comment on column public.eigenaar.iban is 'Rekeningnummer van de eigenaar (bankmatching)';
comment on column public.transactie.tegenpartij_iban is 'IBAN van de tegenpartij uit de bankexport';

create index if not exists transactie_tegenpartij_iban_idx
  on public.transactie (tegenpartij_iban);


-- >>> supabase/migrations/20260828120000_voorschotten_bankrelatie.sql

-- =============================================================================
-- Fase 2b/2c: voorschotten per boekjaar + configureerbare bankrelaties
-- =============================================================================

-- --- eigenaar: voornaam apart -------------------------------------------------
alter table public.eigenaar add column if not exists voornaam text;
comment on column public.eigenaar.voornaam is 'Voornaam van de eigenaar';

-- --- bankrelatie: configureerbare tegenpartijen (Watergroep, mazout, ...) ----
create table if not exists public.bankrelatie (
  id                          uuid primary key default gen_random_uuid(),
  vme_id                      uuid not null references public.vme(id) on delete cascade,
  naam                        text not null,
  iban                        text not null,
  type                        text not null check (type in ('leverancier','eigen_rekening','overig')),
  standaard_categorie         text,
  standaard_verdeelsleutel_id uuid references public.verdeelsleutel(id) on delete set null,
  standaard_betaler_type      text check (standaard_betaler_type in ('eigenaar','huurder')),
  created_at                  timestamptz not null default now()
);
create index if not exists bankrelatie_vme_idx on public.bankrelatie(vme_id);
create unique index if not exists bankrelatie_vme_iban_idx
  on public.bankrelatie(vme_id, iban);

-- --- voorschotten herwerken -------------------------------------------------
-- Oud model (Ã©Ã©n lopende voorschot-tabel + lopend-saldo-view) verdwijnt.
-- Nieuw: eigenaars per unit per boekjaar (AV-beslissing),
--        huurders per huurder per boekjaar (variabel).
drop view if exists public.unit_saldo;
drop function if exists public.bereken_verschuldigd_voorschotten(uuid, text, date);
drop table if exists public.voorschot;

create table if not exists public.voorschot_eigenaar (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid not null references public.unit(id) on delete cascade,
  boekjaar_id      uuid not null references public.boekjaar(id) on delete cascade,
  bedrag_per_maand numeric(14,2) not null check (bedrag_per_maand >= 0),
  created_at       timestamptz not null default now(),
  unique (unit_id, boekjaar_id)
);
create index if not exists voorschot_eigenaar_boekjaar_idx on public.voorschot_eigenaar(boekjaar_id);

create table if not exists public.voorschot_huurder (
  id               uuid primary key default gen_random_uuid(),
  huurder_id       uuid not null references public.huurder(id) on delete cascade,
  boekjaar_id      uuid not null references public.boekjaar(id) on delete cascade,
  bedrag_per_maand numeric(14,2) not null check (bedrag_per_maand >= 0),
  created_at       timestamptz not null default now(),
  unique (huurder_id, boekjaar_id)
);
create index if not exists voorschot_huurder_boekjaar_idx on public.voorschot_huurder(boekjaar_id);

-- --- RLS --------------------------------------------------------------------
grant select, insert, update, delete on
  public.bankrelatie, public.voorschot_eigenaar, public.voorschot_huurder
  to authenticated;

alter table public.bankrelatie        enable row level security;
alter table public.voorschot_eigenaar enable row level security;
alter table public.voorschot_huurder  enable row level security;

drop policy if exists bankrelatie_admin_all on public.bankrelatie;
create policy bankrelatie_admin_all on public.bankrelatie
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists bankrelatie_select_eigenaar on public.bankrelatie;
create policy bankrelatie_select_eigenaar on public.bankrelatie
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists vse_admin_all on public.voorschot_eigenaar;
create policy vse_admin_all on public.voorschot_eigenaar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists vse_select_eigenaar on public.voorschot_eigenaar;
create policy vse_select_eigenaar on public.voorschot_eigenaar
  for select to authenticated using (public.owns_unit(unit_id));

drop policy if exists vsh_admin_all on public.voorschot_huurder;
create policy vsh_admin_all on public.voorschot_huurder
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists vsh_select_eigenaar on public.voorschot_huurder;
create policy vsh_select_eigenaar on public.voorschot_huurder
  for select to authenticated using (
    exists (
      select 1 from public.huurder h
      where h.id = huurder_id and public.owns_unit(h.unit_id)
    )
  );


-- >>> supabase/migrations/20260828130000_tellers_prijzen.sql

-- =============================================================================
-- Fase 2d: tellers, meterstanden, eenheidsprijzen + afrekening-detail
-- =============================================================================

-- --- tellers: elk appartement heeft warm water, koud water en CV ------------
create table if not exists public.teller (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.unit(id) on delete cascade,
  type        text not null check (type in ('warm_water','koud_water','cv')),
  meternummer text,
  created_at  timestamptz not null default now(),
  unique (unit_id, type)
);
create index if not exists teller_unit_idx on public.teller(unit_id);

-- --- meterstanden ----------------------------------------------------------
create table if not exists public.meterstand (
  id         uuid primary key default gen_random_uuid(),
  teller_id  uuid not null references public.teller(id) on delete cascade,
  datum      date not null,
  waarde     numeric(14,3) not null check (waarde >= 0),
  aanleiding text not null default 'tussentijds'
             check (aanleiding in ('boekjaareinde','huurderwissel','einde_huurder','start_huurder','tussentijds')),
  huurder_id uuid references public.huurder(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists meterstand_teller_datum_idx
  on public.meterstand(teller_id, datum);

-- --- eenheidsprijzen per VME + boekjaar ------------------------------------
create table if not exists public.eenheidsprijs (
  id                     uuid primary key default gen_random_uuid(),
  vme_id                 uuid not null references public.vme(id) on delete cascade,
  boekjaar_id            uuid not null references public.boekjaar(id) on delete cascade,
  prijs_water_per_m3     numeric(14,4) not null default 6.51,
  mazoutprijs_per_liter  numeric(14,4) not null default 0.81,
  cv_liter_per_m3        numeric(14,4) not null default 0.20,
  warmwater_liter_per_m3 numeric(14,4) not null default 1.00,
  created_at             timestamptz not null default now(),
  unique (vme_id, boekjaar_id)
);

-- --- afrekening: onderscheid per huurder + detailregels -------------------
alter table public.afrekening
  add column if not exists huurder_id uuid references public.huurder(id) on delete cascade;

alter table public.afrekening
  drop constraint if exists afrekening_boekjaar_id_unit_id_betaler_type_key;
alter table public.afrekening
  drop constraint if exists afrekening_uniek;

-- NULLS NOT DISTINCT (PG15+): eigenaar-rijen hebben huurder_id = null en zijn
-- toch uniek per (boekjaar, unit).
alter table public.afrekening
  add constraint afrekening_uniek
  unique nulls not distinct (boekjaar_id, unit_id, betaler_type, huurder_id);

create table if not exists public.afrekening_lijn (
  id            uuid primary key default gen_random_uuid(),
  afrekening_id uuid not null references public.afrekening(id) on delete cascade,
  soort         text not null,      -- koud_water | warm_water | stookolie | gedeeld | overig
  omschrijving  text not null,
  hoeveelheid   numeric(14,3),
  eenheid       text,
  eenheidsprijs numeric(14,4),
  bedrag        numeric(14,2) not null,
  created_at    timestamptz not null default now()
);
create index if not exists afrekening_lijn_afr_idx on public.afrekening_lijn(afrekening_id);

-- --- factuur <-> betaling (1 op 1) ---------------------------------------
alter table public.kosten
  add column if not exists betaald_met_transactie_id uuid
  references public.transactie(id) on delete set null;

-- --- RLS -----------------------------------------------------------------
grant select, insert, update, delete on
  public.teller, public.meterstand, public.eenheidsprijs, public.afrekening_lijn
  to authenticated;

alter table public.teller         enable row level security;
alter table public.meterstand     enable row level security;
alter table public.eenheidsprijs  enable row level security;
alter table public.afrekening_lijn enable row level security;

drop policy if exists teller_admin_all on public.teller;
create policy teller_admin_all on public.teller
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists teller_select_eigenaar on public.teller;
create policy teller_select_eigenaar on public.teller
  for select to authenticated using (public.owns_unit(unit_id));

drop policy if exists meterstand_admin_all on public.meterstand;
create policy meterstand_admin_all on public.meterstand
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists meterstand_select_eigenaar on public.meterstand;
create policy meterstand_select_eigenaar on public.meterstand
  for select to authenticated using (
    exists (
      select 1 from public.teller t
      where t.id = teller_id and public.owns_unit(t.unit_id)
    )
  );

drop policy if exists eenheidsprijs_admin_all on public.eenheidsprijs;
create policy eenheidsprijs_admin_all on public.eenheidsprijs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists eenheidsprijs_select_eigenaar on public.eenheidsprijs;
create policy eenheidsprijs_select_eigenaar on public.eenheidsprijs
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists afrekening_lijn_admin_all on public.afrekening_lijn;
create policy afrekening_lijn_admin_all on public.afrekening_lijn
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists afrekening_lijn_select_eigenaar on public.afrekening_lijn;
create policy afrekening_lijn_select_eigenaar on public.afrekening_lijn
  for select to authenticated using (
    exists (
      select 1 from public.afrekening a
      where a.id = afrekening_id and public.owns_unit(a.unit_id)
    )
  );


-- >>> supabase/migrations/20260828140000_pdf_import.sql

-- =============================================================================
-- Fase 2g: KBC-PDF-import + onderscheid rekening/soort per verrichting
-- =============================================================================
-- De VME heeft twee rekeningen:
--   * zichtrekening  (vme.iban)         -> voorschotten gemeenschappelijke
--                                          kosten van de bewoners + leveranciers
--   * spaarrekening  (vme.iban_reserve) -> maandelijkse reservefonds-provisie
--                                          van de eigenaars + kapitaalsoproepen
-- =============================================================================

alter table public.transactie
  add column if not exists rekening text
    check (rekening is null or rekening in ('zicht','spaar')),
  add column if not exists soort text not null default 'overig'
    check (soort in (
      'voorschot',            -- bewoner (zicht) of eigenaar-reservefonds (spaar)
      'afrekening',            -- settlement vorig boekjaar (niet meetellen)
      'kost',                  -- betaling aan leverancier
      'interne_overboeking',   -- transfer tussen de eigen rekeningen
      'kapitaalsoproep',       -- eenmalige eigenaarsbijdrage (bv. gevelwerken)
      'rente',
      'terugbetaling',
      'overig'
    ));

create index if not exists transactie_soort_idx on public.transactie (soort);

-- domiciliÃ«ringen hebben geen IBAN, wel een mandaatreferte
alter table public.bankrelatie
  add column if not exists mandaatreferte text;

comment on column public.transactie.rekening is 'Op welke VME-rekening de verrichting staat: zicht of spaar';
comment on column public.transactie.soort is 'Aard van de verrichting; enkel soort=voorschot telt mee in de voorschot-matching';
comment on column public.bankrelatie.mandaatreferte is 'Mandaatreferte voor domiciliÃ«ringen zonder tegenpartij-IBAN';


-- >>> supabase/migrations/20260828150000_kostenverdeling.sql

-- =============================================================================
-- Fase 2h: expliciete verdeelmethode per kost + import die kosten aanmaakt (2f)
-- =============================================================================
-- Verdeelmethodes:
--   individueel_verbruik : via de tellers (koud/warm water, stookolie)
--   gelijk_huurders      : gelijk over alle appartementen, pro rata bewoningsdagen
--                          (elektriciteit, schoonmaak, materiaal, bankkosten,
--                           watergroep-terugbetaling = negatief)
--   per_quotiteit        : via de verdeelsleutel-aandelen (eigenaarskosten)
--   gelijk_eigenaars     : gelijk over alle units/eigenaars (eigenaarskost zonder
--                          individuele toewijzing)
-- =============================================================================

alter table public.kosten
  add column if not exists verdeling text not null default 'gelijk_huurders'
    check (verdeling in (
      'individueel_verbruik','gelijk_huurders','per_quotiteit','gelijk_eigenaars'
    )),
  add column if not exists omschrijving_extra text;

-- bestaande kosten een zinvolle verdeling geven
update public.kosten set verdeling = case
  when betaler_type = 'huurder'
       and lower(coalesce(categorie,'')) in
         ('koud water','warm water','koud_water','warm_water','mazout','stookolie')
    then 'individueel_verbruik'
  when betaler_type = 'huurder' then 'gelijk_huurders'
  when verdeelsleutel_id is not null then 'per_quotiteit'
  else 'gelijk_eigenaars'
end
where verdeling = 'gelijk_huurders';   -- enkel de default overschrijven

alter table public.bankrelatie
  add column if not exists standaard_verdeling text
    check (standaard_verdeling is null or standaard_verdeling in (
      'individueel_verbruik','gelijk_huurders','per_quotiteit','gelijk_eigenaars'
    )),
  -- substring-match op de tegenpartijnaam voor verrichtingen zonder IBAN
  -- (bv. "Verbruik KBC-Bedrijfsrekening")
  add column if not exists naam_bevat text;

-- IBAN mag nu leeg zijn (domiciliÃ«ringen / bankkosten worden op mandaatreferte
-- of naam herkend)
alter table public.bankrelatie alter column iban drop not null;

-- bestaande bankrelaties een verdeling geven op basis van de oude betaler/categorie
update public.bankrelatie set standaard_verdeling = case
  when standaard_betaler_type = 'huurder'
       and lower(coalesce(standaard_categorie,'')) in
         ('koud water','warm water','koud_water','warm_water','mazout','stookolie')
    then 'individueel_verbruik'
  when standaard_betaler_type = 'huurder' then 'gelijk_huurders'
  when standaard_verdeelsleutel_id is not null then 'per_quotiteit'
  when standaard_betaler_type = 'eigenaar' then 'gelijk_eigenaars'
  else null
end
where standaard_verdeling is null;

comment on column public.kosten.verdeling is 'Hoe deze kost verdeeld wordt in de afrekening';
comment on column public.bankrelatie.naam_bevat is 'Herken de tegenpartij aan een deel van de naam (geen IBAN nodig)';



-- =============================================================================
-- Fase 2i: bankuittreksel (dashboard: begin-/eindsaldo per rekening)
-- =============================================================================
-- =============================================================================
-- Fase 2i: bankuittreksel — één rij per geïmporteerd rekeninguittreksel.
-- Laat het boekjaar-dashboard het echte begin-/eindsaldo per rekening tonen en
-- detecteren of de zicht-/spaarrekening voor dat boekjaar al geüpload is.
-- =============================================================================

create table if not exists public.bankuittreksel (
  id uuid primary key default gen_random_uuid(),
  vme_id uuid not null references public.vme(id) on delete cascade,
  rekening text not null check (rekening in ('zicht','spaar')),
  bron text not null default 'pdf' check (bron in ('xls','pdf')),
  periode_van date,
  periode_tot date,
  saldo_begin numeric(12,2),
  saldo_eind numeric(12,2),
  aantal_verrichtingen int not null default 0,
  bestandsnaam text,
  created_at timestamptz not null default now()
);

create index if not exists bankuittreksel_vme_idx
  on public.bankuittreksel (vme_id, rekening, periode_van);

alter table public.bankuittreksel enable row level security;
grant select, insert, update, delete on public.bankuittreksel to authenticated;

drop policy if exists bankuittreksel_admin_all on public.bankuittreksel;
create policy bankuittreksel_admin_all on public.bankuittreksel
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists bankuittreksel_select_eigenaar on public.bankuittreksel;
create policy bankuittreksel_select_eigenaar on public.bankuittreksel
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.bankuittreksel is
  'Metadata per geïmporteerd bankuittreksel (periode + saldo), voor het dashboard.';

-- =============================================================================
-- Fase 2j: document (algemeen documentbeheer per VME/boekjaar)
-- =============================================================================
-- =============================================================================
-- Fase 2j: algemeen documentbeheer per VME/boekjaar (notulen, contracten,
-- facturen, ...). Los van kosten.document_url (bewijsstukken bij een kost).
-- Bestanden staan in de bestaande storage-bucket 'documenten' (admin-only);
-- downloads lopen via een server-side signed-URL-route.
-- =============================================================================

create table if not exists public.document (
  id uuid primary key default gen_random_uuid(),
  vme_id uuid not null references public.vme(id) on delete cascade,
  boekjaar_id uuid references public.boekjaar(id) on delete set null,
  naam text not null,
  pad text not null,
  mimetype text,
  grootte bigint,
  categorie text,
  created_at timestamptz not null default now()
);

create index if not exists document_vme_idx on public.document (vme_id, boekjaar_id);

alter table public.document enable row level security;
grant select, insert, update, delete on public.document to authenticated;

drop policy if exists document_admin_all on public.document;
create policy document_admin_all on public.document
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists document_select_eigenaar on public.document;
create policy document_select_eigenaar on public.document
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.document is
  'Algemene VME-documenten (notulen, contracten, facturen). Bestand in bucket documenten.';

-- =============================================================================
-- Fase 2k: transactie.boekjaar_id (expliciet boekjaar i.p.v. datum-afleiding)
-- =============================================================================
-- =============================================================================
-- Fase 2k: transactie expliciet aan een boekjaar kunnen koppelen.
-- Leeg (default) = boekjaar wordt afgeleid uit transactie.datum. Gezet =
-- overschrijft dat (bv. een voorschot dat begin dit boekjaar al eind vorig
-- boekjaar betaald werd).
-- =============================================================================

alter table public.transactie
  add column if not exists boekjaar_id uuid
  references public.boekjaar(id) on delete set null;

create index if not exists transactie_boekjaar_idx
  on public.transactie (boekjaar_id);

comment on column public.transactie.boekjaar_id is
  'Expliciet boekjaar; leeg = afgeleid uit de datum';

-- =============================================================================
-- Fase 3B: kosten.rekening + categorie
-- =============================================================================
-- =============================================================================
-- Fase 3B: kosten strikt per rekening (spec §3/§8/§9) + beheerbare categorieën.
-- =============================================================================

-- --- kosten.rekening -------------------------------------------------------
alter table public.kosten
  add column if not exists rekening text
  check (rekening is null or rekening in ('zicht', 'spaar'));

-- backfill 1: uit de gekoppelde banktransactie
update public.kosten k
set rekening = t.rekening
from public.transactie t
where k.betaald_met_transactie_id = t.id
  and k.rekening is null
  and t.rekening is not null;

-- backfill 2: afleiden uit de verdeling (eigenaarskost -> spaar, anders zicht)
update public.kosten
set rekening = case
  when verdeling in ('gelijk_eigenaars', 'per_quotiteit') then 'spaar'
  else 'zicht'
end
where rekening is null;

alter table public.kosten alter column rekening set not null;
create index if not exists kosten_rekening_idx on public.kosten (vme_id, rekening);

-- --- categorie ------------------------------------------------------------
create table if not exists public.categorie (
  id         uuid primary key default gen_random_uuid(),
  vme_id     uuid not null references public.vme(id) on delete cascade,
  naam       text not null,
  groep      text not null default 'divers'
             check (groep in ('verbruik', 'divers', 'eigenaar')),
  actief     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (vme_id, naam)
);
create index if not exists categorie_vme_idx on public.categorie (vme_id);

alter table public.categorie enable row level security;
grant select, insert, update, delete on public.categorie to authenticated;

drop policy if exists categorie_admin_all on public.categorie;
create policy categorie_admin_all on public.categorie
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists categorie_select_eigenaar on public.categorie;
create policy categorie_select_eigenaar on public.categorie
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.categorie is
  'Beheerbare kosten-/opbrengstcategorieën per VME. kosten.categorie blijft de tekstwaarde; deze tabel stuurt de keuzelijst en de groep (verbruik/divers/eigenaar).';

-- =============================================================================
-- Fase 3C: document.transactie_id
-- =============================================================================
-- =============================================================================
-- Fase 3C: een document kan aan een banktransactie gekoppeld worden (spec §20).
-- =============================================================================

alter table public.document
  add column if not exists transactie_id uuid
  references public.transactie(id) on delete set null;

create index if not exists document_transactie_idx
  on public.document (transactie_id);

comment on column public.document.transactie_id is
  'Optionele koppeling aan een banktransactie (factuur bij betaling).';
-- =============================================================================
-- Actiepunten per VME: taken die de syndicus opvolgt. Handmatig toegevoegd of
-- overgenomen uit een jaarverslag / notulen (bron = 'jaarverslag').
-- =============================================================================

create table if not exists public.actiepunt (
  id                uuid primary key default gen_random_uuid(),
  vme_id            uuid not null references public.vme(id) on delete cascade,
  boekjaar_id       uuid references public.boekjaar(id) on delete set null,
  titel             text not null,
  omschrijving      text,
  status            text not null default 'open'
                    check (status in ('open', 'bezig', 'afgewerkt')),
  deadline          date,
  verantwoordelijke text,
  bron              text not null default 'handmatig'
                    check (bron in ('handmatig', 'jaarverslag')),
  document_id       uuid references public.document(id) on delete set null,
  created_at        timestamptz not null default now(),
  afgewerkt_op      timestamptz
);

create index if not exists actiepunt_vme_idx on public.actiepunt (vme_id, status);

alter table public.actiepunt enable row level security;
grant select, insert, update, delete on public.actiepunt to authenticated;

drop policy if exists actiepunt_admin_all on public.actiepunt;
create policy actiepunt_admin_all on public.actiepunt
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists actiepunt_select_eigenaar on public.actiepunt;
create policy actiepunt_select_eigenaar on public.actiepunt
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.actiepunt is
  'Opvolgpunten per VME. bron = handmatig of jaarverslag (uit notulen overgenomen).';
-- =============================================================================
-- Extra afrekeningsparameters:
--  * eenheidsprijs.administratie_pct  — % administratiekosten VME dat mee wordt
--    doorgerekend aan de huurders (op hun verbruik + aandeel gedeelde kosten).
--  * mazout_levering.bedrag           — totaal factuurbedrag van een levering;
--    zo kan je een levering ingeven met (liter + bedrag) i.p.v. (liter + prijs).
--    De afrekening rekent met de GEWOGEN gemiddelde prijs over alle leveringen
--    van het boekjaar (som bedragen / som liters), met eenheidsprijs.
--    mazoutprijs_per_liter als terugval wanneer er geen leveringen zijn.
-- =============================================================================

alter table public.eenheidsprijs
  add column if not exists administratie_pct numeric(6,3) not null default 0
  check (administratie_pct >= 0 and administratie_pct <= 100);

alter table public.mazout_levering
  add column if not exists bedrag numeric(14,2)
  check (bedrag is null or bedrag >= 0);

comment on column public.eenheidsprijs.administratie_pct is
  '% administratiekosten VME, doorgerekend aan de huurders op (verbruik + gedeeld).';
comment on column public.mazout_levering.bedrag is
  'Totaal factuurbedrag van de levering (optioneel); prijs_per_liter = bedrag / liter.';


-- >>> supabase/migrations/20260901150000_vme_kbo_gegevens.sql

-- =============================================================================
-- VME-gegevens (KBO / juridisch) — allemaal optioneel, los aanpasbaar.
-- Overzicht zichtbaar onder Instellingen → VME-gegevens.
-- =============================================================================

alter table public.vme
  add column if not exists ondernemingsnummer text,
  add column if not exists rechtsvorm         text,
  add column if not exists type_entiteit      text,
  add column if not exists kbo_status         text,
  add column if not exists rechtstoestand     text,
  add column if not exists begindatum         date,
  add column if not exists officiele_naam     text,
  add column if not exists afkorting          text,
  add column if not exists zetel_adres        text,
  add column if not exists telefoon           text,
  add column if not exists email              text,
  add column if not exists webadres           text,
  add column if not exists syndicus_naam      text,
  add column if not exists syndicus_sinds     date;

comment on column public.vme.ondernemingsnummer is 'KBO-ondernemingsnummer, bv. 0479.495.447';
comment on column public.vme.rechtsvorm         is 'Rechtsvorm, bv. Vereniging van mede-eigenaars';
comment on column public.vme.type_entiteit      is 'Type entiteit, bv. Rechtspersoon';
comment on column public.vme.kbo_status         is 'KBO-status, bv. Actief';
comment on column public.vme.rechtstoestand     is 'Rechtstoestand, bv. Normale toestand';
comment on column public.vme.begindatum         is 'Begindatum van de vereniging (KBO)';
comment on column public.vme.officiele_naam     is 'Volledige officiële naam zoals in de KBO';
comment on column public.vme.afkorting          is 'Officiële afkorting';
comment on column public.vme.zetel_adres        is 'Adres van de maatschappelijke zetel';
comment on column public.vme.telefoon           is 'Telefoonnummer van de VME';
comment on column public.vme.email              is 'E-mailadres van de VME';
comment on column public.vme.webadres           is 'Webadres van de VME';
comment on column public.vme.syndicus_naam      is 'Naam van de aangestelde syndicus';
comment on column public.vme.syndicus_sinds     is 'Syndicus aangesteld sinds';


-- >>> supabase/migrations/20260902100000_unit_quotiteit.sql

-- =============================================================================
-- Quotiteit per appartement: het aandeel in de gemene delen (meestal /1000 of
-- /10000). Basis voor het stemgewicht en het aanwezigheidsquorum op de AV.
-- Optioneel — zonder quotiteiten telt elk appartement voor 1.
-- =============================================================================

alter table public.unit
  add column if not exists quotiteit numeric(12,4)
  check (quotiteit is null or quotiteit >= 0);

comment on column public.unit.quotiteit is
  'Aandeel van het appartement in de gemene delen (bv. /1000). Basis voor AV-stemgewicht.';


-- >>> supabase/migrations/20260902110000_av_module.sql

-- =============================================================================
-- AV-module (Algemene Vergadering): vergaderingen, agenda + beslissingen,
-- aanwezigheden/volmachten. Stemgewicht via unit.quotiteit (zie
-- 20260902100000_unit_quotiteit.sql).
-- =============================================================================

create table if not exists public.av_vergadering (
  id                   uuid primary key default gen_random_uuid(),
  vme_id               uuid not null references public.vme(id) on delete cascade,
  boekjaar_id          uuid references public.boekjaar(id) on delete set null,
  datum                date not null,
  type                 text not null default 'gewoon'
                       check (type in ('gewoon', 'buitengewoon')),
  locatie              text,
  status               text not null default 'gepland'
                       check (status in ('gepland', 'gehouden', 'geannuleerd')),
  notulen_document_id  uuid references public.document(id) on delete set null,
  omschrijving         text,
  created_at           timestamptz not null default now()
);
create index if not exists av_vergadering_vme_idx
  on public.av_vergadering (vme_id, datum desc);

create table if not exists public.av_agendapunt (
  id                 uuid primary key default gen_random_uuid(),
  av_id              uuid not null references public.av_vergadering(id) on delete cascade,
  vme_id             uuid not null references public.vme(id) on delete cascade,
  volgnr             int not null default 1,
  titel              text not null,
  toelichting        text,
  meerderheid        text not null default 'volstrekt'
                     check (meerderheid in ('informatief', 'volstrekt', 'twee_derde', 'vier_vijfde', 'unaniem')),
  beslissing         text,
  stemmen_voor       numeric(12,4),
  stemmen_tegen      numeric(12,4),
  stemmen_onthouding numeric(12,4),
  aangenomen         boolean,
  actiepunt_id       uuid references public.actiepunt(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists av_agendapunt_av_idx
  on public.av_agendapunt (av_id, volgnr);
create index if not exists av_agendapunt_vme_idx on public.av_agendapunt (vme_id);

create table if not exists public.av_aanwezigheid (
  id            uuid primary key default gen_random_uuid(),
  av_id         uuid not null references public.av_vergadering(id) on delete cascade,
  vme_id        uuid not null references public.vme(id) on delete cascade,
  unit_id       uuid not null references public.unit(id) on delete cascade,
  aanwezigheid  text not null default 'afwezig'
                check (aanwezigheid in ('aanwezig', 'volmacht', 'afwezig')),
  volmacht_naam text,
  created_at    timestamptz not null default now(),
  unique (av_id, unit_id)
);
create index if not exists av_aanwezigheid_av_idx on public.av_aanwezigheid (av_id);
create index if not exists av_aanwezigheid_vme_idx on public.av_aanwezigheid (vme_id);

-- actiepunt kan nu ook uit een AV-beslissing komen
alter table public.actiepunt drop constraint if exists actiepunt_bron_check;
alter table public.actiepunt add constraint actiepunt_bron_check
  check (bron in ('handmatig', 'jaarverslag', 'av'));

-- --- RLS ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.av_vergadering, public.av_agendapunt, public.av_aanwezigheid
  to authenticated;

alter table public.av_vergadering  enable row level security;
alter table public.av_agendapunt   enable row level security;
alter table public.av_aanwezigheid enable row level security;

drop policy if exists av_vergadering_admin_all on public.av_vergadering;
create policy av_vergadering_admin_all on public.av_vergadering
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists av_vergadering_select_eigenaar on public.av_vergadering;
create policy av_vergadering_select_eigenaar on public.av_vergadering
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists av_agendapunt_admin_all on public.av_agendapunt;
create policy av_agendapunt_admin_all on public.av_agendapunt
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists av_agendapunt_select_eigenaar on public.av_agendapunt;
create policy av_agendapunt_select_eigenaar on public.av_agendapunt
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists av_aanwezigheid_admin_all on public.av_aanwezigheid;
create policy av_aanwezigheid_admin_all on public.av_aanwezigheid
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists av_aanwezigheid_select_eigenaar on public.av_aanwezigheid;
create policy av_aanwezigheid_select_eigenaar on public.av_aanwezigheid
  for select to authenticated using (public.owns_vme(vme_id));

comment on table public.av_vergadering is 'Algemene Vergaderingen van de VME.';
comment on table public.av_agendapunt is 'Agendapunten + beslissingen per AV.';
comment on table public.av_aanwezigheid is 'Aanwezigheid/volmacht per appartement per AV.';


-- >>> supabase/migrations/20260902120000_verzekering_module.sql

-- =============================================================================
-- Verzekeringsmodule: polissenregister + schadedossiers. De betaalde premies
-- blijven gewone kosten (categorie 'verzekering') — die worden read-side
-- gekoppeld, geen aparte tabel.
-- =============================================================================

create table if not exists public.verzekering_polis (
  id            uuid primary key default gen_random_uuid(),
  vme_id        uuid not null references public.vme(id) on delete cascade,
  maatschappij  text not null,
  polisnummer   text,
  type          text not null default 'brand'
                check (type in ('brand', 'ba_gebouw', 'rechtsbijstand',
                                'bestuurdersaansprakelijkheid',
                                'objectieve_aansprakelijkheid', 'overig')),
  jaarpremie    numeric(14,2) check (jaarpremie is null or jaarpremie >= 0),
  ingang_datum  date,
  vervaldatum   date,
  hoofdvervaldag text,
  makelaar      text,
  document_id   uuid references public.document(id) on delete set null,
  opmerkingen   text,
  actief        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists verzekering_polis_vme_idx
  on public.verzekering_polis (vme_id);

create table if not exists public.verzekering_schade (
  id               uuid primary key default gen_random_uuid(),
  vme_id           uuid not null references public.vme(id) on delete cascade,
  polis_id         uuid not null references public.verzekering_polis(id) on delete cascade,
  unit_id          uuid references public.unit(id) on delete set null,
  datum            date not null,
  omschrijving     text not null,
  status           text not null default 'gemeld'
                   check (status in ('gemeld', 'in_behandeling', 'afgehandeld', 'geweigerd')),
  dossiernummer    text,
  schadebedrag     numeric(14,2) check (schadebedrag is null or schadebedrag >= 0),
  uitgekeerd_bedrag numeric(14,2) check (uitgekeerd_bedrag is null or uitgekeerd_bedrag >= 0),
  document_id      uuid references public.document(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists verzekering_schade_polis_idx
  on public.verzekering_schade (polis_id);
create index if not exists verzekering_schade_vme_idx
  on public.verzekering_schade (vme_id);

-- --- RLS ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.verzekering_polis, public.verzekering_schade
  to authenticated;

alter table public.verzekering_polis  enable row level security;
alter table public.verzekering_schade enable row level security;

drop policy if exists verzekering_polis_admin_all on public.verzekering_polis;
create policy verzekering_polis_admin_all on public.verzekering_polis
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists verzekering_polis_select_eigenaar on public.verzekering_polis;
create policy verzekering_polis_select_eigenaar on public.verzekering_polis
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists verzekering_schade_admin_all on public.verzekering_schade;
create policy verzekering_schade_admin_all on public.verzekering_schade
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists verzekering_schade_select_eigenaar on public.verzekering_schade;
create policy verzekering_schade_select_eigenaar on public.verzekering_schade
  for select to authenticated using (public.owns_vme(vme_id));

comment on table public.verzekering_polis is 'Verzekeringspolissen van de VME.';
comment on table public.verzekering_schade is 'Schadedossiers per polis.';


-- >>> supabase/migrations/20260903100000_meteropname.sql

-- =============================================================================
-- Meterstand via foto: staging-tabel tussen een geüploade tellerfoto en een
-- definitieve `meterstand`. De syndicus én de eigenaar (voor zijn eigen
-- appartement) kunnen een foto indienen; lokale OCR vult waarde + meternummer
-- als voorstel in. Een eigenaarsopname wordt pas een echte `meterstand` nadat
-- de syndicus ze bevestigt.
-- =============================================================================

create table if not exists public.meteropname (
  id                  uuid primary key default gen_random_uuid(),
  vme_id              uuid not null references public.vme(id) on delete cascade,
  unit_id             uuid not null references public.unit(id) on delete cascade,
  teller_id           uuid references public.teller(id) on delete set null,
  boekjaar_id         uuid references public.boekjaar(id) on delete set null,
  document_id         uuid references public.document(id) on delete set null,
  ingediend_door      uuid,                       -- auth.users.id (geen FK: cross-schema)
  rol                 text not null check (rol in ('syndicus','eigenaar')),
  opname_datum        date,                       -- uit EXIF, bewerkbaar
  herkende_waarde     numeric(14,3),              -- ruwe OCR
  herkend_meternummer text,                       -- ruwe OCR
  waarde              numeric(14,3),              -- bevestigde waarde
  status              text not null default 'nieuw'
                      check (status in ('nieuw','verwerkt','afgewezen')),
  meterstand_id       uuid references public.meterstand(id) on delete set null,
  opmerking           text,
  created_at          timestamptz not null default now()
);
create index if not exists meteropname_vme_status_idx
  on public.meteropname (vme_id, status);
create index if not exists meteropname_unit_idx on public.meteropname (unit_id);

alter table public.meteropname enable row level security;
grant select, insert, update, delete on public.meteropname to authenticated;

drop policy if exists meteropname_admin_all on public.meteropname;
create policy meteropname_admin_all on public.meteropname
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists meteropname_eigenaar_select on public.meteropname;
create policy meteropname_eigenaar_select on public.meteropname
  for select to authenticated using (public.owns_unit(unit_id));

drop policy if exists meteropname_eigenaar_insert on public.meteropname;
create policy meteropname_eigenaar_insert on public.meteropname
  for insert to authenticated
  with check (public.owns_unit(unit_id) and rol = 'eigenaar');

comment on table public.meteropname is
  'Ingediende tellerfotos (syndicus + eigenaar) met OCR-voorstel; wordt na bevestiging een meterstand.';
