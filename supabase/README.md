# Supabase – database & auth

## Migraties toepassen

De migraties staan in `supabase/migrations/` en zijn genummerd op timestamp.
Ze worden in volgorde toegepast.

### Optie A – Supabase CLI (aanbevolen)

```bash
npm i -g supabase
supabase link --project-ref <jouw-project-ref>
supabase db push
```

### Optie B – SQL Editor

Open in het Supabase-dashboard **SQL Editor** en plak de inhoud van elk bestand
in `supabase/migrations/` **in volgorde**:

1. `20260828090000_schema.sql`
2. `20260828090100_functions.sql`
3. `20260828090200_rls.sql`
4. `20260828090300_storage.sql`

## Eerste syndicus (admin) aanmaken

1. Zorg dat `NEXT_PUBLIC_SITE_URL` klopt en start de app.
2. Ga naar `/login`, vul je e-mailadres in, klik de magic link in je mailbox.
   Er wordt automatisch een rij in `public.profiles` aangemaakt.
3. Zet die gebruiker op admin via de SQL Editor:

   ```sql
   update public.profiles set is_admin = true
   where email = 'jouw@email.be';
   ```

4. Log opnieuw in (of refresh). Je komt nu op `/admin`.

## Auth-instellingen in het dashboard

- **Authentication → Providers → Email**: "Enable Email provider" aan,
  "Confirm email" aan is prima (magic link bevestigt meteen).
- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000` (dev) of je productie-URL.
  - Redirect URLs: voeg `http://localhost:3000/**` en je productie-URL toe.
- De app gebruikt **magic link / OTP** login; er worden geen wachtwoorden bewaard.

## RLS-tests

`supabase/tests/rls_test.sql` bevat pgTAP-tests die controleren dat een eigenaar
nooit data van een andere unit of VME kan lezen. Draaien met de CLI:

```bash
supabase test db
```
