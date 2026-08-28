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
