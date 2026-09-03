-- =============================================================================
-- Meterstand via foto: staging-tabel tussen een geüploade tellerfoto en een
-- definitieve `meterstand`. De syndicus én de eigenaar (voor zijn eigen
-- appartement) kunnen een foto indienen; lokale OCR vult waarde + meternummer
-- als voorstel in. Een eigenaarsopname wordt pas een echte `meterstand` nadat
-- de syndicus ze bevestigt.
-- =============================================================================

create table if not exists public.meteropname (
  id                  uuid primary key default gen_random_uuid(),
  vme_id              uuid not null references public.vme(id) on delete cascade,
  unit_id             uuid not null references public.unit(id) on delete cascade,
  teller_id           uuid references public.teller(id) on delete set null,
  boekjaar_id         uuid references public.boekjaar(id) on delete set null,
  document_id         uuid references public.document(id) on delete set null,
  ingediend_door      uuid,                       -- auth.users.id (geen FK: cross-schema)
  rol                 text not null check (rol in ('syndicus','eigenaar')),
  opname_datum        date,                       -- uit EXIF, bewerkbaar
  herkende_waarde     numeric(14,3),              -- ruwe OCR
  herkend_meternummer text,                       -- ruwe OCR
  waarde              numeric(14,3),              -- bevestigde waarde
  status              text not null default 'nieuw'
                      check (status in ('nieuw','verwerkt','afgewezen')),
  meterstand_id       uuid references public.meterstand(id) on delete set null,
  opmerking           text,
  created_at          timestamptz not null default now()
);
create index if not exists meteropname_vme_status_idx
  on public.meteropname (vme_id, status);
create index if not exists meteropname_unit_idx on public.meteropname (unit_id);

alter table public.meteropname enable row level security;
grant select, insert, update, delete on public.meteropname to authenticated;

drop policy if exists meteropname_admin_all on public.meteropname;
create policy meteropname_admin_all on public.meteropname
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists meteropname_eigenaar_select on public.meteropname;
create policy meteropname_eigenaar_select on public.meteropname
  for select to authenticated using (public.owns_unit(unit_id));

drop policy if exists meteropname_eigenaar_insert on public.meteropname;
create policy meteropname_eigenaar_insert on public.meteropname
  for insert to authenticated
  with check (public.owns_unit(unit_id) and rol = 'eigenaar');

comment on table public.meteropname is
  'Ingediende tellerfotos (syndicus + eigenaar) met OCR-voorstel; wordt na bevestiging een meterstand.';
