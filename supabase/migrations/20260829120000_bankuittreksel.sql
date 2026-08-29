-- =============================================================================
-- Fase 2i: bankuittreksel — één rij per geïmporteerd rekeninguittreksel.
-- Laat het boekjaar-dashboard het echte begin-/eindsaldo per rekening tonen en
-- detecteren of de zicht-/spaarrekening voor dat boekjaar al geüpload is.
-- =============================================================================

create table if not exists public.bankuittreksel (
  id uuid primary key default gen_random_uuid(),
  vme_id uuid not null references public.vme(id) on delete cascade,
  rekening text not null check (rekening in ('zicht','spaar')),
  bron text not null default 'pdf' check (bron in ('xls','pdf')),
  periode_van date,
  periode_tot date,
  saldo_begin numeric(12,2),
  saldo_eind numeric(12,2),
  aantal_verrichtingen int not null default 0,
  bestandsnaam text,
  created_at timestamptz not null default now()
);

create index if not exists bankuittreksel_vme_idx
  on public.bankuittreksel (vme_id, rekening, periode_van);

alter table public.bankuittreksel enable row level security;
grant select, insert, update, delete on public.bankuittreksel to authenticated;

drop policy if exists bankuittreksel_admin_all on public.bankuittreksel;
create policy bankuittreksel_admin_all on public.bankuittreksel
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists bankuittreksel_select_eigenaar on public.bankuittreksel;
create policy bankuittreksel_select_eigenaar on public.bankuittreksel
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.bankuittreksel is
  'Metadata per geïmporteerd bankuittreksel (periode + saldo), voor het dashboard.';
