-- MyVME - Fase 2 updates (2a t/m 2h). Veilig om meermaals te draaien.

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


