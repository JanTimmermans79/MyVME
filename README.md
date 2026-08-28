# MyVME — beheertool voor een Vereniging van Mede-Eigenaars

Multi-tenant beheertool voor een syndicus: kosten, verdeelsleutels, voorschotten,
bankimport met matching, jaarafrekeningen en per-eigenaar dashboards.
Start met 1 VME, maar het datamodel ondersteunt meerdere VME's per syndicus.

## Stack

| Onderdeel        | Keuze                                             |
| ---------------- | ------------------------------------------------- |
| Framework        | Next.js 16 (App Router) + React 19 + TypeScript   |
| UI               | Tailwind CSS v4 + shadcn/ui                       |
| Hosting          | Vercel                                            |
| Database + auth  | Supabase (Postgres + Supabase Auth + RLS)         |
| Mail             | EmailJS (uitsluitend client-side, admin-sessie)   |
| Bankexport       | XLS/XLSX (hoofdformaat), PDF = fase 2             |

## Rollen

- **Syndicus (admin)** — `profiles.is_admin = true`. Volledige toegang: VME's,
  units, verdeelsleutels, kosten, mazout, voorschotten, bankimport,
  jaarafrekeningen + mailverzending.
- **Eigenaar** — ziet enkel de eigen unit(s): lopend saldo, jaarafrekeningen;
  bewerkt eigen contactgegevens en de huurderfiches van de eigen unit(s).
- **Huurder** — geen account; een contactfiche beheerd door de eigenaar.

Alle toegang wordt afgedwongen met Row Level Security (zie
[`supabase/migrations`](supabase/migrations) en de RLS-tests in
[`supabase/tests`](supabase/tests)).

## Lokaal opstarten

```bash
npm install
cp .env.example .env.local   # en invullen (zie hieronder)
npm run dev
```

### Environment-variabelen (`.env.local`)

| Variabele                          | Waar vandaan                                   |
| ---------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | Supabase → Project Settings → API              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | idem (anon public key)                         |
| `SUPABASE_SERVICE_ROLE_KEY`        | idem (service_role — **server only**)          |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID`   | EmailJS → Email Services                       |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`  | EmailJS → Email Templates                      |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`   | EmailJS → Account → API Keys                   |
| `NEXT_PUBLIC_SITE_URL`             | `http://localhost:3000` of de productie-URL    |

## Supabase opzetten

Zie [`supabase/README.md`](supabase/README.md). Kort:

1. Migraties toepassen (`supabase db push` of via de SQL Editor, in volgorde).
2. In het dashboard: Email-provider aan, Site URL + Redirect URLs instellen.
3. Aanmelden via `/login`, daarna in de SQL Editor:
   `update public.profiles set is_admin = true where email = '...';`

## Deployen naar Vercel

1. Repo importeren in Vercel (framework wordt automatisch herkend als Next.js).
2. Dezelfde environment-variabelen instellen als in `.env.local`, met
   `NEXT_PUBLIC_SITE_URL` = de Vercel-URL (later het Combell-domein — fase 2).
3. Voeg de productie-URL toe aan Supabase → Auth → Redirect URLs.
4. Deploy. `next build` draait op Vercel; er is geen extra configuratie nodig.

## EmailJS-template

Maak één template aan met deze variabelen (allemaal strings):

| Variabele        | Inhoud                                             |
| ---------------- | ------------------------------------------------- |
| `to_email`       | ontvanger (gebruik dit als "To Email")            |
| `to_name`        | naam ontvanger                                     |
| `vme_naam`       | naam van de VME                                    |
| `vme_iban`       | rekeningnummer VME                                 |
| `boekjaar`       | periode, bv. "01-01-2025 – 31-12-2025"             |
| `unit_naam`      | bv. "Appartement 2A"                               |
| `betaler_type`   | "eigenaar" of "huurder"                            |
| `bedrag`         | absoluut saldo, bv. "€ 123,45"                     |
| `richting`       | "bijbetaling", "terugbetaling" of "in evenwicht"   |
| `saldo`          | getekend saldo, bv. "-€ 123,45"                    |

Voorbeeld-body:

> Beste {{to_name}},
>
> Hierbij de afrekening voor {{unit_naam}} ({{vme_naam}}) voor het boekjaar
> {{boekjaar}}.
>
> Resultaat: **{{bedrag}} {{richting}}**.
>
> Bij een bijbetaling schrijf je dit bedrag over op {{vme_iban}} met vermelding
> van {{unit_naam}}. Bij een terugbetaling storten wij het bedrag terug.
>
> Met vriendelijke groeten,
> De syndicus

Mails worden **enkel** verstuurd door een ingelogde admin via de knop
"Verstuur" op `/admin/afrekeningen` — nooit automatisch of vanaf een publieke
route.

## Scripts

| Commando            | Doel                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | ontwikkelserver               |
| `npm run build`     | productiebuild                |
| `npm run lint`      | ESLint                        |
| `npm run typecheck` | `tsc --noEmit`                |

## Status

### Fase 1 — MVP ✅

Project-scaffold, datamodel + RLS, magic-link auth met rolonderscheid,
VME/units/verdeelsleutels-beheer, eigenaar- en huurderbeheer, manuele kosten +
bewijsstuk-upload, mazoutleveringen, voorschotten, XLS-bankimport met
matching-flow, lopend saldo (SQL-view) + eigenaar-dashboard, jaarafrekening +
EmailJS-verzending.

### Fase 2 — uitbreiding (nog niet gestart)

- AI-factuurextractie met voorstel/bevestig-flow (`kosten.status = 'voorstel'`,
  `bron = 'ai_voorstel'` zijn al voorzien in het model)
- PDF-bankimport als fallback (`transactie.bron = 'pdf'` voorzien)
- Verbruiksvergelijking jaar-op-jaar (tabel `verbruik` voorzien)
- Combell-domein koppelen aan Vercel
