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
             check (aanleiding in ('boekjaareinde','huurderwissel','tussentijds')),
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

create unique index if not exists afrekening_eigenaar_uniek
  on public.afrekening (boekjaar_id, unit_id) where betaler_type = 'eigenaar';
create unique index if not exists afrekening_huurder_uniek
  on public.afrekening (boekjaar_id, huurder_id) where betaler_type = 'huurder';

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

create policy teller_admin_all on public.teller
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy teller_select_eigenaar on public.teller
  for select to authenticated using (public.owns_unit(unit_id));

create policy meterstand_admin_all on public.meterstand
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy meterstand_select_eigenaar on public.meterstand
  for select to authenticated using (
    exists (
      select 1 from public.teller t
      where t.id = teller_id and public.owns_unit(t.unit_id)
    )
  );

create policy eenheidsprijs_admin_all on public.eenheidsprijs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy eenheidsprijs_select_eigenaar on public.eenheidsprijs
  for select to authenticated using (public.owns_vme(vme_id));

create policy afrekening_lijn_admin_all on public.afrekening_lijn
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy afrekening_lijn_select_eigenaar on public.afrekening_lijn
  for select to authenticated using (
    exists (
      select 1 from public.afrekening a
      where a.id = afrekening_id and public.owns_unit(a.unit_id)
    )
  );
