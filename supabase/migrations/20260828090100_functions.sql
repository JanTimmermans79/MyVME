-- =============================================================================
-- Helper-functies (voor RLS) + saldo-berekening
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_admin(): is de huidige gebruiker syndicus?
-- SECURITY DEFINER zodat de RLS-policy op profiles zichzelf niet blokkeert.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- -----------------------------------------------------------------------------
-- owns_unit(): is de huidige gebruiker eigenaar van deze unit?
-- -----------------------------------------------------------------------------
create or replace function public.owns_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.eigenaar e
    where e.auth_user_id = auth.uid() and e.unit_id = p_unit_id
  );
$$;

-- -----------------------------------------------------------------------------
-- owns_vme(): heeft de huidige gebruiker minstens één unit in deze VME?
-- -----------------------------------------------------------------------------
create or replace function public.owns_vme(p_vme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.eigenaar e
    join public.unit u on u.id = e.unit_id
    where e.auth_user_id = auth.uid() and u.vme_id = p_vme_id
  );
$$;

-- -----------------------------------------------------------------------------
-- bereken_verschuldigd_voorschotten()
-- Cumulatief verschuldigd bedrag aan voorschotten voor een unit/betaler_type,
-- van de eerste ingangsdatum t.e.m. de maand van p_tot.
-- Per maand wordt het op dat moment geldende tarief genomen (laatste voorschot
-- met ingang_datum <= einde van die maand). Geen maand-checklist: dit blijft
-- correct bij vroeg/laat betalen en bij tariefwijzigingen.
-- -----------------------------------------------------------------------------
create or replace function public.bereken_verschuldigd_voorschotten(
  p_unit_id uuid,
  p_betaler_type text,
  p_tot date default current_date
)
returns numeric
language sql
stable
as $$
  with grens as (
    select date_trunc('month', min(v.ingang_datum))::date as eerste
    from public.voorschot v
    where v.unit_id = p_unit_id and v.betaler_type = p_betaler_type
  ),
  maanden as (
    select gs::date as maand
    from grens g
    cross join lateral generate_series(
      g.eerste,
      date_trunc('month', p_tot)::date,
      interval '1 month'
    ) as gs
    where g.eerste is not null
  )
  select coalesce(sum(tarief.bedrag_per_maand), 0)::numeric
  from maanden m
  cross join lateral (
    select v.bedrag_per_maand
    from public.voorschot v
    where v.unit_id = p_unit_id
      and v.betaler_type = p_betaler_type
      and v.ingang_datum <= (m.maand + interval '1 month - 1 day')::date
    order by v.ingang_datum desc
    limit 1
  ) tarief;
$$;

-- -----------------------------------------------------------------------------
-- unit_saldo: één lopend saldo per unit / betaler_type.
--   verschuldigd = cumulatieve voorschotten sinds ingangsdatum
--   ontvangen    = som van gematchte banktransacties
--   saldo        = ontvangen - verschuldigd  (negatief => achterstand)
-- security_invoker: de RLS van de opvragende gebruiker is van toepassing.
-- -----------------------------------------------------------------------------
create or replace view public.unit_saldo
with (security_invoker = on) as
select
  u.id                                              as unit_id,
  u.vme_id                                          as vme_id,
  u.naam                                            as unit_naam,
  bt.betaler_type                                   as betaler_type,
  public.bereken_verschuldigd_voorschotten(u.id, bt.betaler_type) as verschuldigd,
  coalesce((
    select sum(t.bedrag)
    from public.transactie t
    where t.gematchte_unit_id = u.id
      and t.betaler_type = bt.betaler_type
  ), 0)                                             as ontvangen,
  coalesce((
    select sum(t.bedrag)
    from public.transactie t
    where t.gematchte_unit_id = u.id
      and t.betaler_type = bt.betaler_type
  ), 0) - public.bereken_verschuldigd_voorschotten(u.id, bt.betaler_type) as saldo
from public.unit u
cross join (values ('eigenaar'::text), ('huurder'::text)) as bt(betaler_type);

-- -----------------------------------------------------------------------------
-- Trigger: profiel automatisch aanmaken bij nieuwe auth-gebruiker.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Trigger: updated_at bijhouden op afrekening.
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists afrekening_touch on public.afrekening;
create trigger afrekening_touch
  before update on public.afrekening
  for each row execute function public.touch_updated_at();
