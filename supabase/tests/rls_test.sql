-- =============================================================================
-- RLS-tests (pgTAP). Draaien met:  supabase test db
--
-- Doel (spec punt 4): bewijzen dat een eigenaar NOOIT data van een andere unit
-- of andere VME kan opvragen of wijzigen, ook niet via een handgemaakte query,
-- en dat de syndicus (admin) wel volledige toegang heeft.
-- =============================================================================

begin;
select plan(14);

-- ---------------------------------------------------------------------------
-- Seed (als postgres/service-role; RLS niet van toepassing)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.be'),
  ('22222222-2222-2222-2222-222222222222', 'ownerA@test.be'),
  ('33333333-3333-3333-3333-333333333333', 'ownerB@test.be');

update public.profiles set is_admin = true
  where id = '11111111-1111-1111-1111-111111111111';

insert into public.vme (id, naam) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'VME A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'VME B');

insert into public.unit (id, vme_id, naam) values
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Unit A'),
  ('b1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Unit B');

insert into public.eigenaar (id, auth_user_id, unit_id, naam, email) values
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'Eigenaar A', 'ownerA@test.be'),
  ('b2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Eigenaar B', 'ownerB@test.be');

insert into public.boekjaar (id, vme_id, start_datum, eind_datum) values
  ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-01', '2025-12-31'),
  ('b3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-01', '2025-12-31');

insert into public.kosten (vme_id, boekjaar_id, categorie, bedrag, datum) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a3333333-3333-3333-3333-333333333333', 'verzekering', 100, '2025-03-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b3333333-3333-3333-3333-333333333333', 'verzekering', 200, '2025-03-01');

-- ===========================================================================
-- Eigenaar A
-- ===========================================================================
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.vme),
  1,
  'Eigenaar A ziet enkel de eigen VME'
);
select is(
  (select count(*)::int from public.vme where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'Eigenaar A kan VME B niet opvragen (directe id-query)'
);
select is(
  (select count(*)::int from public.unit),
  1,
  'Eigenaar A ziet enkel de eigen unit'
);
select is_empty(
  $$ select * from public.unit where id = 'b1111111-1111-1111-1111-111111111111' $$,
  'Eigenaar A kan unit B niet opvragen'
);
select is_empty(
  $$ select * from public.kosten where vme_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'Eigenaar A kan kosten van VME B niet opvragen'
);
select is_empty(
  $$ select * from public.boekjaar where vme_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'Eigenaar A kan boekjaren van VME B niet opvragen'
);
select is(
  (select count(*)::int from public.eigenaar),
  1,
  'Eigenaar A ziet enkel het eigen eigenaar-record'
);

-- Wijzigen van andermans eigenaar-record raakt 0 rijen (RLS filtert de rij weg)
select is(
  (with upd as (
     update public.eigenaar set telefoon = '0000'
     where id = 'b2222222-2222-2222-2222-222222222222'
     returning 1
   )
   select count(*)::int from upd),
  0,
  'Eigenaar A kan het eigenaar-record van B niet wijzigen (0 rijen geraakt)'
);

-- Eigen record wijzigen mag wel
select lives_ok(
  $$ update public.eigenaar set telefoon = '0499' where id = 'a2222222-2222-2222-2222-222222222222' $$,
  'Eigenaar A kan het eigen record wijzigen'
);

-- Een unit aanmaken in een vreemde VME mag niet
select throws_ok(
  $$ insert into public.unit (vme_id, naam) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'hack') $$,
  '42501',
  null,
  'Eigenaar A kan geen unit toevoegen (geen insert-policy)'
);

-- ===========================================================================
-- Eigenaar B ziet spiegelbeeld
-- ===========================================================================
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is(
  (select count(*)::int from public.kosten),
  1,
  'Eigenaar B ziet enkel kosten van de eigen VME'
);
select is(
  (select naam from public.vme),
  'VME B',
  'Eigenaar B ziet enkel VME B'
);

-- ===========================================================================
-- Admin
-- ===========================================================================
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::int from public.vme),
  2,
  'Admin ziet alle VME''s'
);
select is(
  (select count(*)::int from public.kosten),
  2,
  'Admin ziet alle kosten'
);

select * from finish();
rollback;
