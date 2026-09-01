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
