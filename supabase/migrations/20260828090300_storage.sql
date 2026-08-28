-- =============================================================================
-- Storage: private bucket 'documenten' voor kostenbewijzen / facturen.
-- Eigenaars krijgen géén directe leesrechten; de app genereert waar nodig
-- korte-termijn signed URLs (server-side) voor documenten van hun eigen VME.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('documenten', 'documenten', false)
on conflict (id) do nothing;

-- Enkel de syndicus kan objecten in deze bucket lezen/schrijven/verwijderen.
drop policy if exists "documenten_admin_all" on storage.objects;
create policy "documenten_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'documenten' and public.is_admin())
  with check (bucket_id = 'documenten' and public.is_admin());
