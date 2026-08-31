-- =============================================================================
-- Fase 3C: een document kan aan een banktransactie gekoppeld worden (spec §20).
-- =============================================================================

alter table public.document
  add column if not exists transactie_id uuid
  references public.transactie(id) on delete set null;

create index if not exists document_transactie_idx
  on public.document (transactie_id);

comment on column public.document.transactie_id is
  'Optionele koppeling aan een banktransactie (factuur bij betaling).';
