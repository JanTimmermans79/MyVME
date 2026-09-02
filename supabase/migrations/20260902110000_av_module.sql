-- =============================================================================
-- AV-module (Algemene Vergadering): vergaderingen, agenda + beslissingen,
-- aanwezigheden/volmachten. Stemgewicht via unit.quotiteit (zie
-- 20260902100000_unit_quotiteit.sql).
-- =============================================================================

create table if not exists public.av_vergadering (
  id                   uuid primary key default gen_random_uuid(),
  vme_id               uuid not null references public.vme(id) on delete cascade,
  boekjaar_id          uuid references public.boekjaar(id) on delete set null,
  datum                date not null,
  type                 text not null default 'gewoon'
                       check (type in ('gewoon', 'buitengewoon')),
  locatie              text,
  status               text not null default 'gepland'
                       check (status in ('gepland', 'gehouden', 'geannuleerd')),
  notulen_document_id  uuid references public.document(id) on delete set null,
  omschrijving         text,
  created_at           timestamptz not null default now()
);
create index if not exists av_vergadering_vme_idx
  on public.av_vergadering (vme_id, datum desc);

create table if not exists public.av_agendapunt (
  id                 uuid primary key default gen_random_uuid(),
  av_id              uuid not null references public.av_vergadering(id) on delete cascade,
  vme_id             uuid not null references public.vme(id) on delete cascade,
  volgnr             int not null default 1,
  titel              text not null,
  toelichting        text,
  meerderheid        text not null default 'volstrekt'
                     check (meerderheid in ('informatief', 'volstrekt', 'twee_derde', 'vier_vijfde', 'unaniem')),
  beslissing         text,
  stemmen_voor       numeric(12,4),
  stemmen_tegen      numeric(12,4),
  stemmen_onthouding numeric(12,4),
  aangenomen         boolean,
  actiepunt_id       uuid references public.actiepunt(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists av_agendapunt_av_idx
  on public.av_agendapunt (av_id, volgnr);
create index if not exists av_agendapunt_vme_idx on public.av_agendapunt (vme_id);

create table if not exists public.av_aanwezigheid (
  id            uuid primary key default gen_random_uuid(),
  av_id         uuid not null references public.av_vergadering(id) on delete cascade,
  vme_id        uuid not null references public.vme(id) on delete cascade,
  unit_id       uuid not null references public.unit(id) on delete cascade,
  aanwezigheid  text not null default 'afwezig'
                check (aanwezigheid in ('aanwezig', 'volmacht', 'afwezig')),
  volmacht_naam text,
  created_at    timestamptz not null default now(),
  unique (av_id, unit_id)
);
create index if not exists av_aanwezigheid_av_idx on public.av_aanwezigheid (av_id);
create index if not exists av_aanwezigheid_vme_idx on public.av_aanwezigheid (vme_id);

-- actiepunt kan nu ook uit een AV-beslissing komen
alter table public.actiepunt drop constraint if exists actiepunt_bron_check;
alter table public.actiepunt add constraint actiepunt_bron_check
  check (bron in ('handmatig', 'jaarverslag', 'av'));

-- --- RLS ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.av_vergadering, public.av_agendapunt, public.av_aanwezigheid
  to authenticated;

alter table public.av_vergadering  enable row level security;
alter table public.av_agendapunt   enable row level security;
alter table public.av_aanwezigheid enable row level security;

drop policy if exists av_vergadering_admin_all on public.av_vergadering;
create policy av_vergadering_admin_all on public.av_vergadering
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists av_vergadering_select_eigenaar on public.av_vergadering;
create policy av_vergadering_select_eigenaar on public.av_vergadering
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists av_agendapunt_admin_all on public.av_agendapunt;
create policy av_agendapunt_admin_all on public.av_agendapunt
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists av_agendapunt_select_eigenaar on public.av_agendapunt;
create policy av_agendapunt_select_eigenaar on public.av_agendapunt
  for select to authenticated using (public.owns_vme(vme_id));

drop policy if exists av_aanwezigheid_admin_all on public.av_aanwezigheid;
create policy av_aanwezigheid_admin_all on public.av_aanwezigheid
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists av_aanwezigheid_select_eigenaar on public.av_aanwezigheid;
create policy av_aanwezigheid_select_eigenaar on public.av_aanwezigheid
  for select to authenticated using (public.owns_vme(vme_id));

comment on table public.av_vergadering is 'Algemene Vergaderingen van de VME.';
comment on table public.av_agendapunt is 'Agendapunten + beslissingen per AV.';
comment on table public.av_aanwezigheid is 'Aanwezigheid/volmacht per appartement per AV.';
