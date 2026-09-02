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
