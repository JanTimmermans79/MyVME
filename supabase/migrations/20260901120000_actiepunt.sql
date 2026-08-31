-- =============================================================================
-- Actiepunten per VME: taken die de syndicus opvolgt. Handmatig toegevoegd of
-- overgenomen uit een jaarverslag / notulen (bron = 'jaarverslag').
-- =============================================================================

create table if not exists public.actiepunt (
  id                uuid primary key default gen_random_uuid(),
  vme_id            uuid not null references public.vme(id) on delete cascade,
  boekjaar_id       uuid references public.boekjaar(id) on delete set null,
  titel             text not null,
  omschrijving      text,
  status            text not null default 'open'
                    check (status in ('open', 'bezig', 'afgewerkt')),
  deadline          date,
  verantwoordelijke text,
  bron              text not null default 'handmatig'
                    check (bron in ('handmatig', 'jaarverslag')),
  document_id       uuid references public.document(id) on delete set null,
  created_at        timestamptz not null default now(),
  afgewerkt_op      timestamptz
);

create index if not exists actiepunt_vme_idx on public.actiepunt (vme_id, status);

alter table public.actiepunt enable row level security;
grant select, insert, update, delete on public.actiepunt to authenticated;

drop policy if exists actiepunt_admin_all on public.actiepunt;
create policy actiepunt_admin_all on public.actiepunt
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists actiepunt_select_eigenaar on public.actiepunt;
create policy actiepunt_select_eigenaar on public.actiepunt
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.actiepunt is
  'Opvolgpunten per VME. bron = handmatig of jaarverslag (uit notulen overgenomen).';
