-- =============================================================================
-- Verzekeringsmodule: polissenregister + schadedossiers. De betaalde premies
-- blijven gewone kosten (categorie 'verzekering') — die worden read-side
-- gekoppeld, geen aparte tabel.
-- =============================================================================

create table if not exists public.verzekering_polis (
  id            uuid primary key default gen_random_uuid(),
  vme_id        uuid not null references public.vme(id) on delete cascade,
  maatschappij  text not null,
  polisnummer   text,
  type          text not null default 'brand'
                check (type in ('brand', 'ba_gebouw', 'rechtsbijstand',
                                'bestuurdersaansprakelijkheid',
                                'objectieve_aansprakelijkheid', 'overig')),
  jaarpremie    numeric(14,2) check (jaarpremie is null or jaarpremie >= 0),
  ingang_datum  date,
  vervaldatum   date,
  hoofdvervaldag text,
  makelaar      text,
  document_id   uuid references public.document(id) on delete set null,
  opmerkingen   text,
  actief        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists verzekering_polis_vme_idx
  on public.verzekering_polis (vme_id);

create table if not exists public.verzekering_schade (
  id               uuid primary key default gen_random_uuid(),
  vme_id           uuid not null references public.vme(id) on delete cascade,
  polis_id         uuid not null references public.verzekering_polis(id) on delete cascade,
  unit_id          uuid references public.unit(id) on delete set null,
  datum            date not null,
  omschrijving     text not null,
  status           text not null default 'gemeld'
                   check (status in ('gemeld', 'in_behandeling', 'afgehandeld', 'geweigerd')),
  dossiernummer    text,
  schadebedrag     numeric(14,2) check (schadebedrag is null or schadebedrag >= 0),
  uitgekeerd_bedrag numeric(14,2) check (uitgekeerd_bedrag is null or uitgekeerd_bedrag >= 0),
  document_id      uuid references public.document(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists verzekering_schade_polis_idx
  on public.verzekering_schade (polis_id);
create index if not exists verzekering_schade_vme_idx
  on public.verzekering_schade (vme_id);

-- --- RLS ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.verzekering_polis, public.verzekering_schade
  to authenticated;

alter table public.verzekering_polis  enable row level security;
alter table public.verzekering_schade enable row level security;

drop policy if exists verzekering_polis_admin_all on public.verzekering_polis;
create policy verzekering_polis_admin_all on public.verzekering_polis
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists verzekering_polis_select_eigenaar on public.verzekering_polis;
create policy verzekering_polis_select_eigenaar on public.verzekering_polis
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists verzekering_schade_admin_all on public.verzekering_schade;
create policy verzekering_schade_admin_all on public.verzekering_schade
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists verzekering_schade_select_eigenaar on public.verzekering_schade;
create policy verzekering_schade_select_eigenaar on public.verzekering_schade
  for select to authenticated using (public.owns_vme(vme_id));

comment on table public.verzekering_polis is 'Verzekeringspolissen van de VME.';
comment on table public.verzekering_schade is 'Schadedossiers per polis.';
