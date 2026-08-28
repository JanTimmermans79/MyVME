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
