-- =============================================================================
-- Water: basis- en comforttarief (De Watergroep).
--
-- Het gebouw heeft één aansluiting, dus slechts één keer een basisvolume. De
-- afrekening verrekent het totale individuele verbruik eerst aan het basistarief
-- (tot het basisvolume, gelijk verdeeld over de appartementen) en de rest aan het
-- comforttarief.
--
--  * water_basisvolume_m3    — basisvolume van de aansluiting per jaar (m³).
--                              Watergroep: 30 m³ per aansluiting + 30 m³ per
--                              gedomicilieerde (bv. 9 gedomicilieerden = 300 m³).
--  * water_basis_per_m3      — basistarief in € per m³, incl. btw en alle
--                              componenten (drinkwater + afvoer + zuivering).
--  * water_comfort_per_m3    — comforttarief in € per m³ (idem; = 2 × basis).
--
-- Zijn deze drie niet ingevuld, dan blijft de afrekening met de vaste
-- eenheidsprijs.prijs_water_per_m3 rekenen (zoals voorheen).
-- =============================================================================

alter table public.eenheidsprijs
  add column if not exists water_basisvolume_m3 numeric(10,2)
    check (water_basisvolume_m3 is null or water_basisvolume_m3 >= 0),
  add column if not exists water_basis_per_m3 numeric(14,4)
    check (water_basis_per_m3 is null or water_basis_per_m3 >= 0),
  add column if not exists water_comfort_per_m3 numeric(14,4)
    check (water_comfort_per_m3 is null or water_comfort_per_m3 >= 0);

comment on column public.eenheidsprijs.water_basisvolume_m3 is
  'Basisvolume van de (ene) aansluiting per jaar, in m³; verdeeld over de appartementen.';
comment on column public.eenheidsprijs.water_basis_per_m3 is
  'Basistarief water in € per m³ (drinkwater + afvoer + zuivering, incl. btw).';
comment on column public.eenheidsprijs.water_comfort_per_m3 is
  'Comforttarief water in € per m³ voor verbruik boven het basisvolume.';

-- =============================================================================
-- Syndicuskosten: % dat aan de huurders wordt doorgerekend (per boekjaar).
--
-- Kosten met categorie 'syndicus' (die op de eigenaars staan) worden voor dit %
-- over de huurders verdeeld (zoals de overige gedeelde kosten) en komen voor
-- het resterende deel bij de eigenaars. 0 = syndicuskosten niet doorrekenen.
-- =============================================================================

alter table public.eenheidsprijs
  add column if not exists syndicus_pct_huurders numeric(5,2) not null default 0
    check (syndicus_pct_huurders >= 0 and syndicus_pct_huurders <= 100);

comment on column public.eenheidsprijs.syndicus_pct_huurders is
  'Percentage van de syndicuskosten (categorie syndicus) dat aan de huurders wordt doorgerekend.';
