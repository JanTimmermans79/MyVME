# MyVME — volledig overzichtsdossier

> **Doel van dit document:** één zelfstandig bestand met *alles* over de MyVME-app
> — visie, functionaliteit, schermen, datamodel, businesslogica, formules,
> concrete data en openstaande punten — bruikbaar als context voor een
> brainstormgesprek (bv. in een gewone Claude-chat) zonder toegang tot de code.
>
> Momentopname: **2 september 2026**. Leidende specs in de repo:
> `docs/functionele-specificatie.md` en `docs/schermstructuur.md`.

---

## 1. Wat is MyVME

MyVME is een **multi-tenant webapplicatie voor de financiële administratie en de
jaarlijkse afrekening van een Belgische VME** (Vereniging van Mede-Eigenaars — de
juridische vereniging van eigenaars van een appartementsgebouw). Ze wordt gebruikt
door de **syndicus** (beheerder) en geeft de eigenaars inzage.

**Kernidee:** van *bankbestanden + voorschotten + meterstanden* naar een
**gecontroleerde jaarafrekening per appartement**, met zo weinig mogelijk
handwerk en waarbij elke berekening traceerbaar is tot op de oorspronkelijke
banktransactie en het bewijsstuk.

**Grondprincipes (uit de functionele spec):**

1. **Eén bron van waarheid.** Elk gegeven wordt één keer ingevoerd/opgeslagen en
   overal hergebruikt. Geen dubbele invoerschermen of functionaliteiten.
2. **Bankbestanden zijn de bron.** Kosten, opbrengsten, betaalde voorschotten en
   saldi komen uit de geïmporteerde transacties — geen aparte kopieën.
3. **De jaarafrekening is de centrale functionaliteit.**
4. **Spaarrekening (kapitaal/reservefonds) en zichtrekening (werkrekening) zijn
   overal strikt gescheiden.** Een gecombineerd totaal wordt expliciet zo genoemd.
5. **Kosten worden toegewezen aan huurders of eigenaars**, met een verdeelwijze.
6. **De syndicus controleert.** Elke automatische classificatie/berekening is een
   voorstel dat aanpasbaar is.
7. **Alles is klikbaar** van totaal → categorie → transactie → factuur.
8. **Elke build ruimt op:** dubbele/verouderde schermen, routes en benamingen weg.

---

## 2. Gebruikers & rollen

| Rol | Herkenning | Kan |
|---|---|---|
| **Syndicus** | `profiles.is_admin = true` | Alles: alle VME's beheren, bankbestanden importeren, kosten classificeren, afrekeningen maken en mailen, instellingen beheren. |
| **Eigenaar** | heeft ≥ 1 `eigenaar`-rij | Enkel inzage in de eigen VME('s) en de eigen afrekening (`/dashboard`, `/dashboard/contact`). Afgedwongen via RLS. |

Eén auth-gebruiker kan meerdere `eigenaar`-rijen hebben (meerdere appartementen).
Huurders hebben **geen** account — hun contactfiche wordt door de syndicus
beheerd.

---

## 3. Techniek

| Laag | Keuze |
|---|---|
| Framework | **Next.js 16.3.3** (App Router, Turbopack), **React 19.2** |
| Taal / stijl | TypeScript, **Tailwind CSS v4**, **shadcn/ui** (radix-ui), lucide-iconen, `sonner` toasts, `next-themes` |
| Backend | **Supabase** — Postgres + Auth (magic-link e-mail) + Row Level Security + Storage |
| Hosting | **Vercel** |
| E-mail (afrekeningen) | **EmailJS**, uitsluitend client-side |
| Bankbestanden inlezen | `xlsx` (SheetJS) voor XLS/XLSX, `pdf-parse` voor KBC-PDF |
| Formulieren | server actions + `react-hook-form` + `zod` (licht gebruikt) |

**Belangrijke conventies in de code:**

- **Route groups** onder `src/app/admin/`: `(kies)` = VME-kiezer, `(werk)` = het
  eigenlijke werkgebied (vereist een actieve VME).
- **Twee Supabase-clients:** een RLS-client (als de ingelogde gebruiker) en een
  service-role *admin*-client (`createAdminClient`) die pas draait ná
  `requireAdmin()` — via de helper `runAdmin()`.
- **RLS-helperfuncties** (SECURITY DEFINER): `is_admin()`, `owns_unit(unit_id)`,
  `owns_vme(vme_id)`.
- **Server actions** volgen één patroon: `runAdmin(async (db) => …)` →
  `ActionState { ok, error?, message? }`; formulierhelpers `str / optStr / num`.
- **Actieve context via cookies:** `myvme_active_vme` en `myvme_active_boekjaar`.
  Alles in `(werk)` wordt gefilterd op deze twee. Geen actieve VME → redirect naar
  de kiezer.
- **DDL (migraties)** staan in `supabase/migrations/*.sql` + samengevoegd in
  `supabase/full_setup.sql` (lege DB) en `supabase/fase2_updates.sql`. Ze worden
  handmatig in de Supabase SQL Editor uitgevoerd.
- **Domeintypes** worden met de hand bijgehouden in `src/lib/types.ts` (geen
  gegenereerde types).

---

## 4. Navigatie & schermen

**Shell:** vaste zijbalk links (merkblok + hoofdmenu + gebruiker/afmelden),
bovenaan een **contextbalk** `VME ▾ · Boekjaar ▾`. De boekjaarkeuze bepaalt alle
cijfers. Elke sub-/detailpagina heeft een **← Terug**-knop.

**Hoofdmenu (`/admin/...`):**

| Menu | Route | Inhoud |
|---|---|---|
| **Dashboard** | `/admin/dashboard` | Financiële cockpit voor de AV: gecombineerde totalen, blok spaarrekening + blok zichtrekening (in/uit/saldo, klikbaar), belangrijke kosten & opbrengsten, voorschotstand huurders/eigenaars, verbruik per appartement, evolutiegrafieken (tot 10 jaar), afwijkingssignalen. |
| ↳ drilldowns | `/admin/dashboard/[stroom]` | `stroom ∈ zicht-in / zicht-uit / spaar-in / spaar-uit`; transacties gegroepeerd per categorie/soort, subtotalen, `?bj=` voor een ander boekjaar. |
| ↳ contacten | `/admin/dashboard/contacten` | Eigenaars + boekjaar-gebonden huurders per appartement. |
| **Kosten & Opbrengsten** | `/admin/financien` | Hub. Sub: **Bankbestanden**, **Zichtrekening**, **Spaarrekening**. |
| ↳ Bankbestanden | `/admin/financien/bank` | Enige plek waar transacties ontstaan. Aparte upload-zones zicht/spaar (KBC-PDF of XLS), preview + saldo-check, importeren (dedupe via `import_hash`), lijst geïmporteerde uittreksels, tabel "te controleren" (soort ▾ · boekjaar ▾ · unit toewijzen · verwijderen). |
| ↳ Zicht / Spaar | `/admin/financien/{zicht,spaar}` | Per rekening: **Kosten**, **Opbrengsten**, **Voorschotcontrole** (huurders bij zicht, eigenaars bij spaar). |
| ↳ Kosten | `.../kosten` | Filter op categorie/leverancier/periode/status/verdeling; "Genereer uit bank", "Kost manueel toevoegen", "Alle voorstellen bevestigen". Rij → kost-detail `/admin/financien/kost/[id]` (alle velden bewerkbaar + herkomst-transacties + impact-preview). |
| ↳ Opbrengsten | `.../opbrengsten` | Gegroepeerd (voorschotten bewoners / afrekeningen vorig jaar / overboeking andere rekening / rente / kapitaalsoproepen / overige). |
| ↳ Voorschotcontrole | `.../voorschotcontrole` | Per huurder/eigenaar: verwacht (pro rata op maandbasis) vs. betaald vs. verschil vs. status. |
| ↳ transactie-detail | `/admin/financien/transactie/[id]` | Tegenpartij + IBAN, mededeling, categorie, betaler, verdeling, boekjaar (automatisch/expliciet), match-status; gekoppelde kost + document; acties om alles te corrigeren. |
| **Voorschotten** | `/admin/voorschotten` | De *opgelegde* maandvoorschotten beheren. Tabs Huurders / Eigenaars, inline bewerkbaar, "overnemen van vorig boekjaar". |
| **Meterstanden** | `/admin/meterstanden` | Eén kaart per appartement: begin → eind → Δ m³ → kost; standenlijst (klik = bewerken); "op schema"-controle (geëxtrapoleerde jaarkost vs. jaarvoorschot); onderaan **Eenheidsprijzen** per boekjaar + knop "Mazoutprijs uit leveringen". |
| **Afrekeningen** | `/admin/afrekeningen` | Kern. Overzicht huurders + eigenaars, "(her)berekenen", waarschuwingenlijst, banner "tussentijds" bij een open boekjaar. |
| ↳ huurder | `/admin/afrekeningen/huurder/[id]` | Volledige afrekening: voorschotten, koud/warm water, stookolie, aandeel gedeelde kosten, administratie%, totaal, saldo. Elke regel klikbaar. Mailen via EmailJS. |
| ↳ eigenaar | `/admin/afrekeningen/eigenaar/[id]` | Aandeel eigenaarskosten via verdeelsleutel + reservefondsprovisies + kapitaalsoproepen + saldo. |
| **Actiepunten** | `/admin/actiepunten` | Opvolgpunten per VME: handmatig of overgenomen uit een jaarverslag/notulen. Status open/bezig/afgewerkt, deadline, verantwoordelijke, optioneel gekoppeld boekjaar/document. |
| **Documenten** | `/admin/documenten` | Upload + categorie (notulen/factuur/contract/verzekering/bankbestand/afrekening/overig), gekoppeld aan boekjaar en optioneel aan een transactie. Bankbestanden verschijnen hier automatisch bij import. |
| **Instellingen** | `/admin/instellingen` | Kaart-hub. VME-gegevens, Boekjaren, Appartementen, Eigenaars, Huurders, Leveranciers, Categorieën, Verdeelsleutels, Mazout. |
| ↳ VME-gegevens | `/admin/vme` | Overzicht + bewerken: naam, adres (werking), IBAN zicht/spaar, aantal kavels, en de optionele **KBO-/juridische gegevens** (zie §6). |

**Eigenaarskant:** `/dashboard` (eigen VME-overzicht) en `/dashboard/contact`.

---

## 5. Centrale gegevensstroom

```
BANKBESTANDEN (zicht + spaar)
    │
    ├─ automatische classificatie  →  soort (voorschot / kost / rente / …)
    │                                 + betaler_type + gematchte unit + verdeling
    │
    ├─ Zichtrekening → Kosten · Opbrengsten · Voorschotcontrole huurders
    └─ Spaarrekening → Kosten · Opbrengsten · Voorschotcontrole eigenaars
METERSTANDEN  (koud water, warm water, CV)
    │
    ▼
KOSTENCLASSIFICATIE → VERDEELREGELS → JAARAFREKENING (per appartement · huurder/eigenaar)
    │
    ▼
DASHBOARD  →  grafieken & historische vergelijking (tot 10 jaar)
```

---

## 6. Datamodel

Alle tabellen in schema `public`, PK `id uuid` tenzij anders vermeld, `created_at
timestamptz`. Bedragen `numeric(14,2)` in EUR. FK's cascaden bij verwijderen van
de VME.

### 6.1 Basis

**`profiles`** — 1-op-1 met `auth.users`.
`id, email, volledige_naam, is_admin bool`.

**`vme`** — de vereniging.
`naam, adres` (werkingsadres), `iban` (zichtrekening), `iban_reserve`
(spaarrekening), `aantal_kavels int`.
*Optionele KBO-/juridische gegevens (sinds sep 2026, allemaal nullable):*
`ondernemingsnummer, rechtsvorm, type_entiteit, kbo_status, rechtstoestand,
begindatum date, officiele_naam, afkorting, zetel_adres, telefoon, email,
webadres, syndicus_naam, syndicus_sinds date`.

**`boekjaar`** — `vme_id, start_datum, eind_datum, status ∈ {open, afgesloten}`.
Boekjaar Mooi Zicht loopt 1 nov → 31 okt.

**`unit`** — appartement. `vme_id, naam`.

**`eigenaar`** — koppelt auth-gebruiker aan unit.
`auth_user_id, unit_id, naam, voornaam, email, telefoon, iban,
structuurcode_prefix`.

**`huurder`** — contactfiche, geen account.
`unit_id, naam, voornaam, email, telefoon, iban, ingang_datum, uitgang_datum`.

### 6.2 Verdeling & categorieën

**`verdeelsleutel`** — `vme_id, naam, type`.
**`verdeelsleutel_aandeel`** — `verdeelsleutel_id, unit_id, aandeel numeric(14,4)`
(PK samengesteld).

**`categorie`** — `vme_id, naam, groep ∈ {verbruik, divers, eigenaar}, actief`.
- `verbruik` = individueel gemeten (koud/warm water, CV, mazout)
- `divers` = gedeeld door huurders (schoonmaak, elektriciteit, onderhoud,
  administratie, diverse)
- `eigenaar` = ten laste van de eigenaars (syndicus, verzekering, lift, grote
  werken, advocaat)

**`bankrelatie`** — leverancier/eigen rekening voor automatische classificatie.
`vme_id, naam, iban, type ∈ {leverancier, eigen_rekening, overig},
standaard_categorie, standaard_verdeelsleutel_id, standaard_betaler_type,
standaard_verdeling, mandaatreferte, naam_bevat`.

### 6.3 Geld

**`bankuittreksel`** — één geïmporteerd bestand.
`vme_id, rekening ∈ {zicht, spaar}, bron ∈ {xls, pdf}, periode_van, periode_tot,
saldo_begin, saldo_eind, aantal_verrichtingen, bestandsnaam`.

**`transactie`** — één bankverrichting. **De bron van waarheid voor alle geld.**
`vme_id, datum, bedrag (± ), tegenpartij_naam, tegenpartij_iban, mededeling,
bron ∈ {xls, pdf}, rekening ∈ {zicht, spaar}, import_hash (uniek per vme, dedupe),
gematchte_unit_id, betaler_type ∈ {eigenaar, huurder}, match_type ∈ {automatisch,
manueel, onbevestigd}, boekjaar_id (nullable — expliciete toewijzing),
soort ∈ { voorschot, afrekening, kost, interne_overboeking, kapitaalsoproep,
rente, terugbetaling, overig }`.

**`kosten`** — een kost binnen een boekjaar (uit bank of manueel).
`vme_id, boekjaar_id, categorie, rekening ∈ {zicht, spaar}, omschrijving, bedrag,
datum, leverancier, document_url, verdeelsleutel_id, betaler_type,
verdeling ∈ {individueel_verbruik, gelijk_huurders, per_quotiteit,
gelijk_eigenaars}, betaald_met_transactie_id, omschrijving_extra,
bron ∈ {manueel, ai_voorstel}, status ∈ {voorstel, bevestigd}`.

**`mazout_levering`** — stookolielevering.
`vme_id, datum, liter numeric(14,2), prijs_per_liter numeric(14,4),
bedrag numeric(14,2) nullable (totaal factuurbedrag; prijs = bedrag / liter),
leverancier`.

**`voorschot_eigenaar`** — `unit_id, boekjaar_id, bedrag_per_maand` (uniek per
paar).
**`voorschot_huurder`** — `huurder_id, boekjaar_id, bedrag_per_maand` (uniek per
paar).

**`verbruik`** — losse jaartotalen voor historische vergelijking (weinig
gebruikt): `vme_id, boekjaar_id, type, waarde, eenheid`.

### 6.4 Meters

**`teller`** — `unit_id, type ∈ {warm_water, koud_water, cv}, meternummer`
(uniek per unit+type).

**`meterstand`** — `teller_id, datum, waarde numeric(14,3), huurder_id (nullable),
aanleiding ∈ { boekjaareinde, einde_huurder, start_huurder, tussentijds,
huurderwissel (verouderd — opgesplitst) }`.
- `boekjaareinde` = datum-gebaseerde jaargrensstand.
- `einde_huurder` = eindstand van een vertrekkende huurder (getagd met die
  huurder). Eindpunt van zijn delta.
- `start_huurder` = beginstand ("ijkpunt") van een nieuwe huurder (getagd met die
  huurder). Vanaf deze waarde lopen zijn delta's.
- `tussentijds` = controlestand; telt mee voor het overzicht/de raming, **niet**
  voor de jaarafrekening.

**`eenheidsprijs`** — per VME + boekjaar.
`prijs_water_per_m3, mazoutprijs_per_liter, cv_liter_per_m3,
warmwater_liter_per_m3, administratie_pct numeric(6,3) (0–100)`.
Defaults in de code: water 6,51 €/m³ · mazout 0,81 €/l · CV 0,20 l/m³ · warm water
1,0 l/m³ · administratie 0 %.

### 6.5 Afrekening

**`afrekening`** — kop per (boekjaar, unit, betaler_type) — uniek.
`huurder_id (nullable), verschuldigd, ontvangen, saldo (= ontvangen −
verschuldigd; + = terugbetalen, − = bijbetalen), mail_verzonden_op, mail_status`.

**`afrekening_lijn`** — detailregel.
`afrekening_id, soort, omschrijving, hoeveelheid, eenheid, eenheidsprijs, bedrag`.

### 6.6 Overig

**`document`** — `vme_id, boekjaar_id (nullable), transactie_id (nullable), naam,
pad (storage), mimetype, grootte, categorie`.

**`actiepunt`** — `vme_id, boekjaar_id (nullable), titel, omschrijving,
status ∈ {open, bezig, afgewerkt}, deadline, verantwoordelijke,
bron ∈ {handmatig, jaarverslag}, document_id (nullable), afgewerkt_op`.

---

## 7. Businesslogica in detail

### 7.1 Twee rekeningen

- **Zichtrekening** (`vme.iban`) — werkrekening. Hierop betalen **huurders** (en
  eigenaar-bewoners) hun maandvoorschotten; hiervan worden leveranciers betaald.
- **Spaarrekening** (`vme.iban_reserve`) — reservefonds/kapitaal. Hierop betalen
  **eigenaars** hun reservefondsprovisie; hiervan grote werken + kapitaalsoproepen.
- **`interne_overboeking`** verschuift geld tussen beide (bv. spaar → zicht om een
  grote factuur te betalen).
- Het dashboard toont de twee stromen **apart**; "Bank saldo" = zicht + spaar,
  expliciet als gecombineerd gelabeld.

### 7.2 Boekjaar-toewijzing van een transactie

`hoortBijBoekjaar(t, bj)`:
- als `t.boekjaar_id` gezet is → exact dat boekjaar (expliciete override);
- anders → `t.datum` binnen `[bj.start_datum, bj.eind_datum]`.

Nodig omdat een vroeg/laat betaald voorschot op de verkeerde kalenderdatum kan
vallen. Op het transactie-detail kan de syndicus het boekjaar expliciet zetten.

### 7.3 Bankimport & automatische classificatie

`src/lib/bank-classify.ts` (+ herimplementatie in het importscript). Per
transactie wordt afgeleid: `soort`, `gematchte_unit_id`, `betaler_type`,
`match_type`.

Volgorde (vereenvoudigd):
1. **Tegenpartij = eigen zicht/spaar-IBAN** → `rente` (mededeling bevat
   "creditrente"/"rente") anders `interne_overboeking`.
2. **IBAN = een eigenaar** → op de spaarrekening: `voorschot` (reservefonds) /
   `kapitaalsoproep` (mededeling "gevel/renovatie/werken/kapitaal/oproep");
   op de zichtrekening: `voorschot` als eigenaar-bewoner.
3. **IBAN = een huurder** → `voorschot` op de zichtrekening.
4. **IBAN = een bankrelatie (leverancier)** → `kost` met de standaardcategorie +
   -toewijzing + -verdeling van die leverancier.
5. **Mededeling bevat "afrekening"** → `afrekening`.
6. Rest → `overig` met `match_type = onbevestigd` (belandt in "te controleren").

Alles is een **voorstel**; de syndicus corrigeert per transactie of stelt de
leverancier bij.

### 7.4 Voorschotcontrole

Per huurder/eigenaar voor het gekozen boekjaar:
- **Verwacht** = `bedrag_per_maand × aantal maanden actief in het boekjaar`
  (maandbasis; de maand van in-/uitstap telt volledig mee). Er wordt óók een
  "volledig jaar"-bedrag getoond.
- **Ontvangen** = som van de `voorschot`-transacties die bij dit boekjaar horen —
  op IBAN gematcht als de IBAN bekend is, anders op periode (zodat een betaling
  niet bij twee co-huurders dubbel telt).
- **Status:** OK (≤ 1 % of € 25 afwijking) · Achterstand (negatief) · Vooruit
  (positief).

### 7.5 Meterstanden & verbruik

Per teller wordt een **delta** bepaald: begin- en eindwaarde.

Voor het **overzicht** (`tellerOverzicht`, per appartement, huidige huurder):
- begin = laatste `boekjaareinde`-stand vóór de boekjaarstart, **tenzij** de
  huidige huurder dit boekjaar instapte → dan zijn `start_huurder`-stand;
- eind = laatste stand in het boekjaar, **tenzij** de huurder dit boekjaar
  vertrok → dan zijn `einde_huurder`-stand;
- bij enkel een tussentijdse stand: "voorlopig", + een **lineaire raming** van de
  jaarkost (verbruik tot nu × 365 / verstreken dagen) vs. het jaarvoorschot →
  badge "op schema" / "verbruik boven voorschot".

Voor de **afrekening** (`meterDelta`): idem, maar per huurder en pro rata zijn
bewoningsperiode. Matcht `einde_huurder`/`start_huurder` **op naam** (huurder_id),
niet op datum. Terugval op een oude, niet-gesplitste `huurderwissel`-stand.

### 7.6 Eenheidsprijzen & stookolieformule

```
koud water kost   = Δ koud (m³)  × prijs_water_per_m3
warm water kost   = Δ warm (m³)  × prijs_water_per_m3
stookolie liter   = Δ CV (m³) × cv_liter_per_m3  +  Δ warm (m³) × warmwater_liter_per_m3
stookolie kost    = stookolie liter × mazoutprijs_per_liter
```

De **`mazoutprijs_per_liter`** die de afrekening gebruikt = **gewogen gemiddelde**
over alle `mazout_levering`-rijen binnen het boekjaar:
`Σ(liter × prijs_per_liter) / Σ liter`. Geen leveringen → terugval op de
handmatige `eenheidsprijs.mazoutprijs_per_liter`.

### 7.7 Huurdersafrekening

Voor elke huurder met een huurperiode die het boekjaar overlapt:

- **Periode** = overlap van de huurperiode met het boekjaar.
- **Voorschotten ontvangen** = som van zijn `voorschot`-transacties (op IBAN,
  anders op periode).
- **Individueel verbruik** = koud water + warm water + stookolie (zie 7.6).
- **Aandeel gedeelde kosten** (categorieën met verdeling `gelijk_huurders`):
  per dag gelijk verdeeld over de appartementen die die dag bewoond zijn
  (`deelfactorVoor`). **Leegstand wordt zo automatisch verdeeld over de aanwezige
  huurders.** Een huurder die halverwege vertrekt/aankomt betaalt enkel voor zijn
  aanwezige dagen.
- **Administratiekosten VME** = `administratie_pct` % op (verbruik + aandeel
  gedeelde kosten) — enkel als er een percentage is ingesteld. Alleen huurders.
- **Totaal kosten** = som van bovenstaande. **Saldo** = ontvangen − totaal.
- **Waarschuwingen** per huurder (voorlopig verbruik, negatief verbruik,
  onvoldoende meterstanden, afwijkende voorschotten) verschijnen bovenaan
  `/admin/afrekeningen`.

**Afrekeningsregels (bevestigd door Jan):**
1. Huurder vertrekt in de loop van het boekjaar → aparte afrekening tot
   `uitgang_datum`; geen kosten/voorschotten daarna.
2. Nieuwe huurder in de loop van het boekjaar → voorschotten + verbruik + aandeel
   gedeelde kosten pro rata vanaf `ingang_datum`.
3. Appartement staat leeg → de gedeelde kost pro rata over de wél aanwezige
   huurders (niet de VME, niet de eigenaars).

### 7.8 Eigenaarsafrekening

Per appartement: aandeel in de eigenaarskosten volgens de verdeelsleutel (of
gelijk), + reservefondsprovisies, + kapitaalsoproepen, − saldo. De
administratie-% en de huurderlogica raken dit niet.

### 7.9 Afrekening opslaan & mailen

"(Her)berekenen" schrijft `afrekening` + `afrekening_lijn` weg (delete + insert
per afrekening). Mailen gebeurt client-side via EmailJS; `mail_verzonden_op` legt
vast dat het verstuurd is. Een vertrokken huurder met verzonden mail is
"afgehandeld" (onderaan de lijst, gedimd).

---

## 8. Concrete data — VME "Mooi Zicht"

Klein gebouw in **Tongeren-Borgloon**, 4 appartementen, boekjaar 1 nov → 31 okt.

### 8.1 VME-gegevens (KBO)

| Veld | Waarde |
|---|---|
| Naam (app) | Mooi Zicht |
| Officiële naam | VERENIGING VAN MEDEEIGENAARS GEBOUW RESIDENTIE MOOI ZICHT TE BORGLONN OORSPRONGSTRAAT 64 |
| Afkorting | MOOI ZICHT |
| Ondernemingsnummer | 0479.495.447 |
| Status / rechtstoestand | Actief / Normale toestand |
| Begindatum | 6 januari 2003 |
| Type / rechtsvorm | Rechtspersoon / Vereniging van mede-eigenaars |
| Adres zetel | Oorsprongstraat 64, 3840 Tongeren-Borgloon |
| Adres werking | Zilverstraat 13a, 3840 Tongeren-Borgloon |
| Syndicus | Timmermans, Jan — sinds 1 september 2022 |
| Zichtrekening | BE17 7353 1730 0021 |
| Spaarrekening | BE84 7450 5726 7859 |
| Aantal kavels | 4 |

### 8.2 Appartementen, eigenaars, huurders

| App. | Eigenaar | Huurders (periode) |
|---|---|---|
| 1 | Jan Timmermans | Inge Houben (11/2018–11/2019) → Nele Driesen (12/2019–11/2022) → **Mandy Machiels** (12/2022–**31/12/2025**) → **Tony De Vos** (vanaf 01/01/2026) |
| 2 | Jan Timmermans | Christophe Slegers (11/2018–12/2020) → **Wesley Stevens** (vanaf 01/01/2021) |
| 3 | Jo Vrancken | **Jo Vrancken** (vanaf 11/2018) — eigenaar-bewoner |
| 4 | Els Vrancken | **Patrick Croughs** (11/2018–**15/06/2025**) → **Christel Dedry** (vanaf **01/07/2025**) |

*App. 1: eigenaar en huurders zijn twee verschillende personen.
App. 4: 16 dagen leegstand tussen Croughs en Dedry (sleutels vroeger overhandigd,
contract pas 01/07).*

### 8.3 Boekjaren

8 boekjaren, **2018-2019 t.e.m. 2023-2024 afgesloten**, **2024-2025 en 2025-2026
open**. Actief voor de meeste tests: 2024-2025 (`d534208e…`) en 2025-2026
(`f6d55852…`).

### 8.4 Financiële omvang (indicatief)

- **1 169 transacties** geïmporteerd (302 voorschot-zicht, 347 voorschot-spaar,
  272 kost-zicht, 55 interne overboekingen, 18 afrekeningen, 4 kapitaalsoproepen,
  1 rente). 907 automatisch geclassificeerd, 53 nog "onbevestigd", 40 manueel.
- **16 bankuittreksels** (zicht + spaar per boekjaar).
- **344 kosten** (300 bevestigd, 44 voorstel). Top-categorieën: elektriciteit
  (93), schoonmaak (90), diverse (46), syndicus (39), koud water (36), mazout (19).
- **Spaarrekening 2024-2025:** begin € 987,02 → eind € 9 387,60.
  **2025-2026 (t.e.m. 29/08):** € 9 387,60 → € 10 739,96.
- **Zichtrekening 2024-2025:** € 3 122,59 → € 2 172,72.
  **2025-2026 (t.e.m. 29/08):** € 2 172,72 → € 3 966,59.
- **26 opgeslagen afrekeningen** (huurders + eigenaars) over drie boekjaren.

### 8.5 Eenheidsprijzen

Alle afgesloten boekjaren: water 6,51 €/m³ · mazout 0,81 €/l · CV 0,20 l/m³ ·
warm water 1,0 l/m³. Boekjaar 2024-2025: CV 0,21. Boekjaar 2025-2026: mazout
1,2535 €/l (hoger — huidige prijs). Administratie 0 % overal.
Er zijn nog **geen `mazout_levering`-rijen** ingevoerd.

### 8.6 Leveranciers (bankrelaties) — standaardclassificatie

| Leverancier | Categorie | Toewijzing | Verdeling |
|---|---|---|---|
| Watergroep | koud water | eigenaar | gelijk_eigenaars |
| ENI / Eneco | elektriciteit | huurder | gelijk_huurders |
| Vrancken (schoonmaak) | schoonmaak | huurder | gelijk_huurders |
| ECOWater / ECOWater Systems | diverse | huurder | gelijk_huurders |
| Koen Voets | mazout | eigenaar | gelijk_eigenaars |
| Fortis AG / KBC Verzekeringen | verzekering | eigenaar | gelijk_eigenaars |
| Syndicus | syndicus | eigenaar | gelijk_eigenaars |
| Advocaat Lauren Vaes | advocaat | eigenaar | gelijk_eigenaars |
| Gevelco | grote werken | eigenaar | gelijk_eigenaars |
| VME Mooi Zicht (spaarrek.) | diverse | — | — |

*Let op: "koud water" en "mazout" staan hier als eigenaar/`gelijk_eigenaars`,
terwijl de afrekening water en stookolie als individueel huurderverbruik behandelt
— de leveranciersconfig en de afrekeningslogica bekijken deze kosten dus vanuit
een verschillende hoek. Aandachtspunt voor de brainstorm.*

### 8.7 Meterstanden

12 tellers (3 per appartement). 228 meterstanden, waarvan 96 `boekjaareinde`,
120 `tussentijds`, 6 `einde_huurder`, 6 `start_huurder`. De huurderwissels App 4
(Croughs → Dedry, 15/06/2025) en App 1 (Machiels → De Vos, 19/12/2025) zijn met
een einde- + startstand vastgelegd.

### 8.8 Verdeelsleutels

Eén sleutel "Mazout" (type Quotiteit) — **nog zonder aandelen** ingevuld.

### 8.9 Actiepunten

- "Airco's plaatsen + offerte opvragen indien interesse" — bezig
- "Voorschotten eigenaars" — open, deadline 30/11/2026

---

## 9. Ontwikkelingsgeschiedenis

**Fase 1** — basis: auth, VME/unit/eigenaar, dashboard-skelet.
**Fase 2 (a–h)** — IBAN-matching, configureerbare leveranciers, voorschotten per
boekjaar, tellers/meterstanden/eenheidsprijzen, KBC-PDF-import, twee
bankrekeningen.
**Fase 3 (A–F)** — herstructurering volgens `functionele-specificatie.md` en
`schermstructuur.md`: menu-opschoning, `FinancieleTabel`, `categorie`-tabel,
Kosten & Opbrengsten per rekening, transactie-/kost-detail, dashboard-drilldowns,
`EvolutieGrafiek` (10 jaar), individuele afrekeningen met klik-traceerbaarheid,
eigenaarsoverzicht.

**Uitbreidingen daarna (aug–sep 2026):**
- gewogen mazoutprijs uit leveringen + `administratie_pct` voor huurders;
- huurderwissel opgesplitst in `einde_huurder` + `start_huurder`;
- **Actiepunten**-module;
- optionele **VME-gegevens** (KBO/juridisch) + overzicht;
- diverse correctness-/performancefixes (rente-classificatie, spaar-drilldown,
  verbruik-fallback, dubbele co-huurder-voorschotten, meterDelta-eindpunt).

---

## 10. Bekende beperkingen & open punten

- **Historische eigenaars** worden niet bijgehouden — enkel de huidige
  `eigenaar`-rij per unit. `voorschot_eigenaar` per (unit, boekjaar) is de enige
  historische bron voor de eigenaarskant.
- **Officiële afrekeningen 2024-2025 verschilden** van wat de app berekent: andere
  eenheidsprijzen (water 6,10 vs 6,51; mazout 0,90 vs 0,81) en een andere
  verdeling van de "andere kosten". De app reproduceert oude afrekeningen dus niet
  exact tenzij je de `eenheidsprijs` van dat boekjaar aanpast.
- **Leveranciersconfig vs. afrekeningslogica** voor water/mazout bekijken dezelfde
  kost verschillend (zie 8.6).
- **`verdeelsleutel_aandeel`** is nog leeg → `per_quotiteit`-verdeling valt terug
  op gelijk verdelen.
- **Geen `mazout_levering`-data** → de gewogen-prijs-functie doet nog niets;
  afrekening gebruikt de handmatige prijs.
- **EmailJS** nog niet geconfigureerd → afrekeningen mailen is uitgeschakeld.
- **Documenten** bevat nog 0 rijen; koppeling document ↔ transactie is er wel maar
  ongebruikt.
- **De raming "op schema"** is lineair (× 365 / verstreken dagen). Zit het
  stookseizoen grotendeels in de meting, dan is dat eerder een bovengrens.
- **`verbruik`-tabel** (losse jaartotalen) is grotendeels ongebruikt naast de
  meterstand-gebaseerde berekening.
- Testdata: er staat één "test VME" en een testhuurder "Tony De Vos"
  (test@mail.com) in de productie-DB.

---

## 11. Mogelijke brainstformrichtingen

Startpunten, geen beslissingen:

- **Rapportage/export:** PDF-jaarafrekening per appartement, AV-rapport, export
  naar boekhoudpakket, wettelijk verplichte documenten (afrekening, begroting).
- **Begroting & vooruitblik:** budget per categorie per boekjaar, vergelijking
  budget vs. realiteit, voorstel maandvoorschot op basis van historiek.
- **Reservefonds-opvolging:** wettelijk minimum, doelkapitaal, kapitaalsoproep
  simuleren.
- **AV-ondersteuning:** notulen → actiepunten (nu handmatig), stemmingen,
  aanwezigheden, volmachten, quotiteiten.
- **Eigenaarsportaal:** rijkere inzage, documenten downloaden, meterstand zelf
  doorgeven, betaalstatus.
- **Automatisering import:** CODA-formaat i.p.v. XLS/PDF, terugkerende
  leveranciers herkennen, factuur-OCR die aan een transactie koppelt.
- **Verdeelsleutels:** quotiteiten echt invullen en overal toepassen; per-lift /
  per-bouwlaag sleutels.
- **Meerdere gebouwen / grotere VME's:** schaalt het model? performance bij
  honderden kavels.
- **Correctheid & audittrail:** afrekening "vastklikken" bij afsluiten boekjaar,
  versiehistoriek, wie-wijzigde-wat.
- **Data-kwaliteit:** de leverancier-vs-afrekeninglogica voor water/mazout
  gladstrijken; historische eigenaars; testdata scheiden van productie.

---

## 12. Woordenlijst

| Term | Betekenis |
|---|---|
| VME | Vereniging van Mede-Eigenaars — de juridische vereniging van de eigenaars |
| Syndicus | Beheerder van de VME (hier: de admin-gebruiker) |
| Boekjaar | Financieel jaar van de VME (Mooi Zicht: 1 nov → 31 okt) |
| Zichtrekening | Werkrekening van de VME (voorschotten bewoners, leveranciers) |
| Spaarrekening | Reservefonds / kapitaal van de VME |
| Reservefonds(provisie) | Maandelijkse bijdrage van de eigenaars aan het kapitaal |
| Kapitaalsoproep | Eenmalige extra bijdrage van de eigenaars (grote werken) |
| Voorschot | Maandelijkse provisie voor de gemeenschappelijke kosten |
| Afrekening | Jaarlijkse verrekening voorschotten vs. werkelijke kosten |
| Verdeelsleutel / quotiteit | Aandeel per appartement in een kost |
| Meterstand / teller | Verbruiksmeting koud water, warm water of centrale verwarming |
| Eenheidsprijs | Prijs per m³ water / per liter mazout, per boekjaar |
| Leegstand | Periode waarin een appartement onbewoond is |
```
