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
