-- =============================================================================
-- Fase 2j: algemeen documentbeheer per VME/boekjaar (notulen, contracten,
-- facturen, ...). Los van kosten.document_url (bewijsstukken bij een kost).
-- Bestanden staan in de bestaande storage-bucket 'documenten' (admin-only);
-- downloads lopen via een server-side signed-URL-route.
-- =============================================================================

create table if not exists public.document (
  id uuid primary key default gen_random_uuid(),
  vme_id uuid not null references public.vme(id) on delete cascade,
  boekjaar_id uuid references public.boekjaar(id) on delete set null,
  naam text not null,
  pad text not null,
  mimetype text,
  grootte bigint,
  categorie text,
  created_at timestamptz not null default now()
);

create index if not exists document_vme_idx on public.document (vme_id, boekjaar_id);

alter table public.document enable row level security;
grant select, insert, update, delete on public.document to authenticated;

drop policy if exists document_admin_all on public.document;
create policy document_admin_all on public.document
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists document_select_eigenaar on public.document;
create policy document_select_eigenaar on public.document
  for select to authenticated
  using (public.owns_vme(vme_id));

comment on table public.document is
  'Algemene VME-documenten (notulen, contracten, facturen). Bestand in bucket documenten.';
