-- =============================================================================
-- Row Level Security. Verplicht vanaf de eerste migratie.
--
-- Regels:
--   * Syndicus (is_admin() = true): volledige toegang tot alles.
--   * Eigenaar: enkel SELECT op eigen VME/unit-gerelateerde data,
--     UPDATE op het eigen eigenaar-record en op gekoppelde huurders.
--   * Een eigenaar kan nooit data van een andere unit of andere VME opvragen,
--     ook niet via een gemanipuleerde query: elke policy filtert server-side
--     via owns_unit() / owns_vme() op basis van auth.uid().
--   * anon (niet ingelogd): geen enkele policy => geen toegang.
-- =============================================================================

-- Basisrechten: Supabase geeft authenticated/anon standaard DML-grants op nieuwe
-- public tabellen. We zetten ze expliciet en trekken gevoelige kolommen terug.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.unit_saldo to authenticated;

alter table public.profiles              enable row level security;
alter table public.vme                   enable row level security;
alter table public.boekjaar              enable row level security;
alter table public.unit                  enable row level security;
alter table public.eigenaar              enable row level security;
alter table public.huurder               enable row level security;
alter table public.verdeelsleutel        enable row level security;
alter table public.verdeelsleutel_aandeel enable row level security;
alter table public.kosten                enable row level security;
alter table public.mazout_levering       enable row level security;
alter table public.verbruik              enable row level security;
alter table public.transactie            enable row level security;
alter table public.voorschot             enable row level security;
alter table public.afrekening            enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Zelf-promotie tot admin voorkomen: is_admin kan een gewone gebruiker niet wijzigen.
revoke update (is_admin) on public.profiles from authenticated;

-- -----------------------------------------------------------------------------
-- vme
-- -----------------------------------------------------------------------------
create policy vme_admin_all on public.vme
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy vme_select_eigenaar on public.vme
  for select to authenticated using (public.owns_vme(id));

-- -----------------------------------------------------------------------------
-- boekjaar
-- -----------------------------------------------------------------------------
create policy boekjaar_admin_all on public.boekjaar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy boekjaar_select_eigenaar on public.boekjaar
  for select to authenticated using (public.owns_vme(vme_id));

-- -----------------------------------------------------------------------------
-- unit
-- -----------------------------------------------------------------------------
create policy unit_admin_all on public.unit
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy unit_select_eigenaar on public.unit
  for select to authenticated using (public.owns_unit(id));

-- -----------------------------------------------------------------------------
-- eigenaar
--   * eigen record: select + update (maar niet unit_id/auth_user_id/prefix)
-- -----------------------------------------------------------------------------
create policy eigenaar_admin_all on public.eigenaar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy eigenaar_select_own on public.eigenaar
  for select to authenticated using (auth_user_id = auth.uid());
create policy eigenaar_update_own on public.eigenaar
  for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

revoke update (unit_id, auth_user_id, structuurcode_prefix) on public.eigenaar from authenticated;

-- -----------------------------------------------------------------------------
-- huurder: eigenaar mag CRUD op huurders van de eigen unit(s)
-- -----------------------------------------------------------------------------
create policy huurder_admin_all on public.huurder
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy huurder_select_eigenaar on public.huurder
  for select to authenticated using (public.owns_unit(unit_id));
create policy huurder_insert_eigenaar on public.huurder
  for insert to authenticated with check (public.owns_unit(unit_id));
create policy huurder_update_eigenaar on public.huurder
  for update to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy huurder_delete_eigenaar on public.huurder
  for delete to authenticated using (public.owns_unit(unit_id));

-- -----------------------------------------------------------------------------
-- verdeelsleutel + aandeel
-- -----------------------------------------------------------------------------
create policy verdeelsleutel_admin_all on public.verdeelsleutel
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy verdeelsleutel_select_eigenaar on public.verdeelsleutel
  for select to authenticated using (public.owns_vme(vme_id));

create policy vs_aandeel_admin_all on public.verdeelsleutel_aandeel
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy vs_aandeel_select_eigenaar on public.verdeelsleutel_aandeel
  for select to authenticated using (public.owns_unit(unit_id));

-- -----------------------------------------------------------------------------
-- kosten: eigenaar ziet enkel BEVESTIGDE kosten van de eigen VME
-- -----------------------------------------------------------------------------
create policy kosten_admin_all on public.kosten
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy kosten_select_eigenaar on public.kosten
  for select to authenticated using (public.owns_vme(vme_id) and status = 'bevestigd');

-- -----------------------------------------------------------------------------
-- mazout_levering
-- -----------------------------------------------------------------------------
create policy mazout_admin_all on public.mazout_levering
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mazout_select_eigenaar on public.mazout_levering
  for select to authenticated using (public.owns_vme(vme_id));

-- -----------------------------------------------------------------------------
-- verbruik
-- -----------------------------------------------------------------------------
create policy verbruik_admin_all on public.verbruik
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy verbruik_select_eigenaar on public.verbruik
  for select to authenticated using (public.owns_vme(vme_id));

-- -----------------------------------------------------------------------------
-- transactie: eigenaar ziet enkel transacties die aan de eigen unit gematcht zijn
-- -----------------------------------------------------------------------------
create policy transactie_admin_all on public.transactie
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy transactie_select_eigenaar on public.transactie
  for select to authenticated using (gematchte_unit_id is not null and public.owns_unit(gematchte_unit_id));

-- -----------------------------------------------------------------------------
-- voorschot
-- -----------------------------------------------------------------------------
create policy voorschot_admin_all on public.voorschot
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy voorschot_select_eigenaar on public.voorschot
  for select to authenticated using (public.owns_unit(unit_id));

-- -----------------------------------------------------------------------------
-- afrekening
-- -----------------------------------------------------------------------------
create policy afrekening_admin_all on public.afrekening
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy afrekening_select_eigenaar on public.afrekening
  for select to authenticated using (public.owns_unit(unit_id));
