-- =============================================================================
-- Huurderwissel opgesplitst in twee losse gebeurtenissen op de meterstand:
--   * 'einde_huurder'  — de eindstand van een vertrekkende huurder
--                        (meterstand.huurder_id = die huurder). Eindpunt voor
--                        de delta-berekening van die huurder.
--   * 'start_huurder'  — de beginstand ("ijkpunt") van een nieuwe huurder
--                        (meterstand.huurder_id = die huurder). Vanaf deze
--                        waarde worden de deltas van de nieuwe huurder gerekend.
-- De oude 'huurderwissel' blijft geldig zodat bestaande rijen niet breken; het
-- migratiescript scripts/split-huurderwissel-standen.mjs zet ze om.
-- =============================================================================

alter table public.meterstand
  drop constraint if exists meterstand_aanleiding_check;

alter table public.meterstand
  add constraint meterstand_aanleiding_check
  check (aanleiding in (
    'boekjaareinde',
    'huurderwissel',
    'einde_huurder',
    'start_huurder',
    'tussentijds'
  ));
