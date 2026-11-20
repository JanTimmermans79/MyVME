-- =============================================================================
-- Structuur + archief
--
--  * unit.type             — appartement, garagebox, parkeerplaats, ...
--  * eigenaar.ingang_datum — eigenaar sinds
--  * eigenaar.eind_datum   — einde eigendom (verkocht). Een einddatum in het
--                            verleden = archief-eigenaar: blijft bewaard voor de
--                            historiek, maar is niet meer actief.
--
-- Herhaalbaar (add column if not exists); wijzigt geen bestaande gegevens.
-- =============================================================================

alter table public.unit
  add column if not exists type text not null default 'appartement';

alter table public.eigenaar
  add column if not exists ingang_datum date,
  add column if not exists eind_datum date;

comment on column public.unit.type is
  'Soort kavel: appartement, garagebox, parkeerplaats, berging, ...';
comment on column public.eigenaar.eind_datum is
  'Einde eigendom (verkocht). In het verleden = archief-eigenaar.';
