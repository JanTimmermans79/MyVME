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
