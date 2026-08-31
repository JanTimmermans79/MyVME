-- =============================================================================
-- Fase 3B: kosten strikt per rekening (spec §3/§8/§9) + beheerbare categorieën.
-- =============================================================================

-- --- kosten.rekening -------------------------------------------------------
alter table public.kosten
  add column if not exists rekening text
  check (rekening is null or rekening in ('zicht', 'spaar'));

-- backfill 1: uit de gekoppelde banktransactie
update public.kosten k
set rekening = t.rekening
from public.transactie t
where k.betaald_met_transactie_id = t.id
  and k.rekening is null
  and t.rekening is not null;

-- backfill 2: afleiden uit de verdeling (eigenaarskost -> spaar, anders zicht)
update public.kosten
set rekening = case
  when verdeling in ('gelijk_eigenaars', 'per_quotiteit') then 'spaar'
  else 'zicht'
end
where rekening is null;

alter table public.kosten alter column rekening set not null;
create index if not exists kosten_rekening_idx on public.kosten (vme_id, rekening);

-- --- categorie ------------------------------------------------------------
create table if not exists public.categorie (
  id         uuid primary key default gen_random_uuid(),
  vme_id     uuid not null references public.vme(id) on delete cascade,
  naam       text not null,
  groep      text not null default 'divers'
             check (groep in ('verbruik', 'divers', 'eigenaar')),
  actief     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (vme_id, naam)
);
create index if not exists categorie_vme_idx on public.categorie (vme_id);

alter table public.categorie enable row level security;
grant select, insert, update, delete on public.categorie to authenticated;

drop policy if exists categorie_admin_all on public.categorie;
create policy categorie_admin_all on public.categorie
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists categorie_select_eigenaar on public.categorie;
create policy categorie_select_eigenaar on public.categorie
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.categorie is
  'Beheerbare kosten-/opbrengstcategorieën per VME. kosten.categorie blijft de tekstwaarde; deze tabel stuurt de keuzelijst en de groep (verbruik/divers/eigenaar).';
