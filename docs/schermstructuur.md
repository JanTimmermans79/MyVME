# Schermstructuur MyVME (UI/UX-blueprint)

> Companion bij [`functionele-specificatie.md`](./functionele-specificatie.md).
> Per scherm: doel, layout, tabellen (met kolommen), acties, filters, drill-down
> en terug-navigatie. Leidend voor Fase A–F. **§-verwijzingen** = de functionele
> spec.
>
> Status: **voorstel** — na te lezen / bij te sturen door Jan.

---

## 0. Globale bouwstenen

### 0.1 Shell & navigatie (§2, §23)
- **Zijbalk** (vast, links): merkblok + 7 hoofdmenu's met icoon:
  `Dashboard · Kosten & Opbrengsten · Voorschotten · Meterstanden · Afrekeningen
  · Documenten · Instellingen`. Onderaan: gebruiker + Afmelden.
- **Contextbalk** (bovenaan werkgebied, altijd): `VME ▾ · Boekjaar ▾ · + Nieuw
  boekjaar`. De boekjaarkeuze bepaalt alles.
- **← Terug** (§23): links bovenaan elke *sub*-pagina en detailpagina, keert naar
  het bovenliggende scherm (niet naar het hoofdmenu). Op hoofdschermen geen
  Terug.
- **Broodkruimel** op detailpagina's: `Dashboard › Zichtrekening › Uitgaven ›
  Onderhoud › Transactie 12-03-2024`.

### 0.2 Financiële standaardtabel (§22)
Één component `FinancieleTabel`, overal identiek:

| Datum | Omschrijving | Leverancier / Tegenpartij | Categorie | Rekening | Bedrag |
|---|---|---|---|---|---:|

- Datum `dd/mm/jjjj`, links. Bedrag rechts, tabular-nums, rood indien negatief.
- **Rekening**: badge `Zicht` / `Spaar`.
- Sorteerbaar op elke kolom (default: datum aflopend). Filterbalk boven: periode,
  rekening, categorie, tekstzoek.
- **Totaalrij** onderaan (som Bedrag), visueel onderscheiden.
- Rij klikbaar → transactie-detail (0.4). Categorie-cel klikbaar → categorie-detail.
- Herbruikt voor: Kosten/Opbrengsten-lijsten, dashboard-drill-downs, afrekening-
  bronnen, documenten-koppeling.

### 0.3 Bedragkaart & klikbaarheid (§4, §6)
- `BedragKaart(label, bedrag, kleur, → doel)` — elk totaal op het dashboard.
- Klik = navigatie naar een lijstpagina die exact dat bedrag opbouwt (zelfde
  boekjaar, zelfde filter). De lijst toont bovenaan het totaal dat je aanklikte.

### 0.4 Transactie-detailpagina `/…/transactie/[id]`
- Kop: datum · bedrag · rekening · soort.
- Velden: tegenpartij + IBAN, mededeling, categorie, betaler (huurder/eigenaar),
  verdeelwijze, boekjaar (met "automatisch/expliciet"), match-status.
- **Gekoppelde kost** (indien): categorie, verdeling, bewijsstuk (opent document).
- **Gekoppeld document**: upload/koppel-knop.
- Acties: categorie wijzigen · betaler wijzigen · verdeelwijze wijzigen · aan
  ander boekjaar koppelen · document koppelen. (Individuele correctie ≠
  leveranciersconfig, §14.)
- ← Terug naar de lijst waar je vandaan kwam.

### 0.5 Grafiek-widget `EvolutieGrafiek` (§5)
- Boven: **metric-selector** (dropdown of chips) + **scope-selector**
  (Volledige blok / App 1 / App 2 / …).
- Metrics: spaar inkomsten/uitgaven/saldo · zicht inkomsten/uitgaven/saldo ·
  kost per categorie (elektriciteit, water, verwarming, onderhoud, schoonmaak,
  administratie, …) · verbruik per teller (koud/warm water, CV) in m³ én €.
- X-as: boekjaren, tot **10 jaar** terug (enkel waar data bestaat).
- Onder de grafiek: minitabel met de exacte jaarwaarden (klikbaar → detail van
  dat jaar).

### 0.6 Statusregels
- Voorschotcontrole-status: `OK` (≤ 1 % of € 25 afwijking) · `Achterstand`
  (negatief) · `Vooruit` (positief). Zelfde 3 labels bij huurders en eigenaars.
- Afrekening-saldo: positief = "terug te krijgen", negatief = "bij te betalen".

---

## 1. Routekaart

| Nieuw pad | Vervangt | Fase |
|---|---|---|
| `/admin` (VME-kiezer) | idem | — |
| `/admin/dashboard` | idem | D |
| `/admin/dashboard/[stroom]` (detail-drilldowns) | nieuw | C |
| `/admin/financien` → redirect naar `/financien/bank` | nieuw hub | A |
| `/admin/financien/bank` | `/admin/bank` | A |
| `/admin/financien/zicht/kosten` | nieuw | B |
| `/admin/financien/zicht/opbrengsten` | nieuw | B |
| `/admin/financien/zicht/voorschotcontrole` | deel van `/admin/afrekeningen` | A |
| `/admin/financien/spaar/kosten` | nieuw | B |
| `/admin/financien/spaar/opbrengsten` | nieuw | B |
| `/admin/financien/spaar/voorschotcontrole` | deel van `/admin/afrekeningen` | A |
| `/admin/financien/transactie/[id]` | nieuw | C |
| `/admin/financien/kost/[id]` | nieuw | C |
| `/admin/voorschotten` (Huurders / Eigenaars tabs) | idem | B |
| `/admin/meterstanden` | `/admin/tellers` | A (rename) |
| `/admin/afrekeningen` (overzicht huurders + eigenaars) | idem, **zonder** voorschotcontrole | A/E |
| `/admin/afrekeningen/huurder/[id]` | idem, uitgebreid | E |
| `/admin/afrekeningen/eigenaar/[id]` | nieuw | E |
| `/admin/documenten` | idem | — |
| `/admin/instellingen` → tabs | `/admin/config` + subpagina's | A |

Oude paden (`/admin/bank`, `/admin/kosten`, `/admin/tellers`, `/admin/config`,
`/admin/units`, …) worden **redirects** in Fase A en in Fase F verwijderd (§26).

---

## 2. Datamodel-aanpassingen

| Wijziging | Reden | Fase |
|---|---|---|
| `kosten.rekening` (`zicht`/`spaar`), afgeleid bij generatie uit `transactie.rekening`, aanpasbaar | §3/§8/§9 — kosten strikt per rekening | B |
| tabel `opbrengst` **niet** nodig — opbrengsten = `transactie` met soort in (voorschot, kapitaalsoproep, rente, afrekening>0, interne_overboeking>0). Views bouwen hierop. | §24 één bron | B |
| tabel `categorie` (vme_id, naam, groep `verbruik`/`divers`/`eigenaar`, actief) i.p.v. vrije tekst | §18 uitbreidbare categorieën, §22 consistente benamingen | B |
| `bankrelatie` → hernoemen "Leverancier" in UI; velden bestaan al (`standaard_categorie`, `standaard_verdeling`, `standaard_betaler_type`, `standaard_verdeelsleutel_id`, `naam_bevat`, `mandaatreferte`) | §14 | A (UI) |
| `document.transactie_id` (nullable FK) — factuur ↔ transactie | §20 | C |
| geen historische-eigenaar-tabel; wél `voorschot_eigenaar` per (unit, boekjaar) blijft de bron voor §9.3 | bekend gat | — |

---

## 3. Dashboard  `/admin/dashboard`

**Doel:** financiële cockpit voor de AV (§4). Geen Terug-knop.

### Layout (van boven naar onder)
1. **Kop**: VME-naam, adres, gekozen boekjaar.
2. **Gecombineerd totaal** (§3 — expliciet als "beide rekeningen samen"):
   4 `BedragKaart`s — *Inkomsten totaal* · *Uitgaven totaal* · *Bank saldo
   (zicht + spaar)* · *Contacten*. Elk klikbaar (→ gecombineerde transactielijst,
   behalve Contacten → Instellingen).
3. **Blok Spaarrekening – kapitaal VME** (§4.2): 3 `BedragKaart`s
   *Inkomsten · Uitgaven · Saldo (begin → eind)*.
   - Inkomsten → `/dashboard/spaar-in` · Uitgaven → `/dashboard/spaar-uit`.
   - Onder de kaarten: `EvolutieGrafiek` met metric vast op "saldo spaarrekening",
     wisselbaar.
4. **Blok Zichtrekening – werkrekening VME** (§4.3): idem 3 kaarten + grafiek.
5. **Belangrijke kosten** (top 5–8 kostencategorieën dit boekjaar, gecombineerd),
   elke rij klikbaar → categorie-detail. + `EvolutieGrafiek` "kost per categorie".
6. **Belangrijke opbrengsten** (voorschotten bewoners, reservefonds, kapitaal­
   oproepen, rente) — klikbaar.
7. **Voorschotten – stand van zaken** (§4.1): 2 mini-kaarten
   *Huurders: X/Y op schema* · *Eigenaars: X/Y op schema*, klikbaar naar de
   respectieve voorschotcontrole (§8.3 / §9.3).
8. **Verbruik per appartement** (§5.2): `EvolutieGrafiek` scope-selector
   (blok / App n), metric koud/warm/CV in m³ of €, tot 10 jaar.
9. **Afwijkingen & opvallende evoluties** (§4.1): automatische signalen
   ("elektriciteit +38 % t.o.v. vorig jaar", "3 huurders in achterstand",
   "zichtrekening onder € 1.000"). Elk klikbaar naar de bron.

### Drill-downpagina's  `/admin/dashboard/[stroom]`
`stroom ∈ spaar-in | spaar-uit | zicht-in | zicht-uit | totaal-in | totaal-uit`
- Kop: het aangeklikte totaal + boekjaar + rekeningfilter.
- **Groepering per categorie** (uitklapbaar), per groep een subtotaal.
- Binnen een groep: `FinancieleTabel` met de transacties.
- ← Terug naar Dashboard.

---

## 4. Kosten & Opbrengsten  `/admin/financien`

Sub-navigatie (tabs of tweede zijbalk):
`Bankbestanden · Zichtrekening · Spaarrekening`.
Elke subpagina heeft ← Terug naar Dashboard.

### 4.1 Bankbestanden importeren  `/financien/bank`  (§7.1)
**Doel:** transacties inlezen; enige plek waar transacties ontstaan.
- 2 duidelijk gescheiden upload-zones: **Zichtrekening** en **Spaarrekening**
  (PDF KBC of XLS). Kop per zone: welk IBAN, welke rekening.
- Na upload: preview-tabel (`FinancieleTabel`-stijl) + saldo-check
  (begin + som = eind ✓/✗) + waarschuwing als de periode buiten het boekjaar valt.
- Knop **Importeren** per zone. Duplicaten (import_hash) worden overgeslagen,
  aantal gemeld.
- **Geïmporteerde uittreksels** (tabel): rekening · periode · beginsaldo ·
  eindsaldo · #verrichtingen · bestand · datum import. Rij klikbaar → de
  transacties van dat uittreksel.
- **Te controleren** (onder): transacties met `match_type = onbevestigd` en soort
  die een keuze vraagt (voorschot zonder unit, overig). Per rij: soort ▾ ·
  boekjaar ▾ · unit toewijzen · verwijderen. (Kosten NIET hier — die staan onder
  Zicht/Spaar → Kosten.)

### 4.2 Zichtrekening  `/financien/zicht`
Kop: rekening-IBAN · **saldo begin → eind** dit boekjaar (uit uittreksel).
Sub-tabs: `Kosten · Opbrengsten · Voorschotcontrole huurders`.

#### 4.2.1 Kosten zichtrekening  (§8.1)
- Filterbalk: categorie · leverancier · periode · status (voorstel/bevestigd) ·
  verdeelwijze.
- Knoppen: **Genereer uit bank** (maakt kostvoorstellen uit soort=kost-
  transacties op de zichtrekening) · **Kost manueel toevoegen** (dialoog) ·
  **Alle voorstellen bevestigen** (dit boekjaar).
- `FinancieleTabel` + extra kolommen: **Verdeelwijze** · **Toewijzing**
  (huurder/eigenaar) · **Status** (badge) · **Bewijs** (📎 indien).
- Rij klikbaar → kost-detail `/financien/kost/[id]`:
  - alle velden bewerkbaar (categorie, bedrag, datum, leverancier, verdeelwijze,
    toewijzing, boekjaar, omschrijving), bewijsstuk vervangen.
  - **Herkomst**: link naar de banktransactie(s) die deze kost dekken (§19).
  - **Impact**: "wordt verdeeld over 4 huurders volgens meterstand" + preview
    per appartement.
  - Bevestigen · Verwijderen · ← Terug.
- Totaalrij = totaal kosten zichtrekening dit boekjaar.

#### 4.2.2 Opbrengsten zichtrekening  (§8.2)
- `FinancieleTabel`, gegroepeerd: *Voorschotten bewoners* · *Ontvangen
  afrekeningen (vorig jaar)* · *Overboeking van de spaarrekening* · *Overige*.
- Rij → transactie-detail. Totaal = totaal opbrengsten zichtrekening.

#### 4.2.3 Voorschotcontrole huurders  (§8.3)  — *verhuisd van Afrekeningen*
- Tabel (`FinancieleTabel`-stijl, aangepaste kolommen):

| Appartement | Huurder | Te betalen (pro rata t.e.m. peildatum) | (volledig jaar) | Betaald | Verschil | Status |
|---|---|---:|---:|---:|---:|---|

- Peildatum = min(vandaag, einde boekjaar). Pro rata op maandbasis.
- "Betaald" = som van de op de zichtrekening ontvangen huurder-voorschotten die
  bij dit boekjaar horen (op IBAN gematcht, anders op periode).
- Verschil-cel klikbaar → de betalingen van die huurder (transactielijst).
- Bovenaan: samenvatting "X van Y huurders op schema".

### 4.3 Spaarrekening  `/financien/spaar`
Identiek aan 4.2 maar voor de spaarrekening:
- **4.3.1 Kosten spaarrekening** (§9.1) — kosten t.l.v. het reservefonds; default
  toewijzing *eigenaar*, verdeelwijze *verdeelsleutel*.
- **4.3.2 Opbrengsten spaarrekening** (§9.2) — groepen: *Reservefonds­provisies
  eigenaars* · *Kapitaalopvragingen* · *Rente* · *Overboeking van de
  zichtrekening* · *Overige*.
- **4.3.3 Voorschotcontrole eigenaars** (§9.3) — zelfde tabelvorm als 4.2.3, maar
  "Betaald" = ontvangen reservefonds­provisies op de **spaarrekening** per unit.

---

## 5. Voorschotten  `/admin/voorschotten`  (§10)

**Doel:** de *opgelegde* voorschotten beheren (niet controleren — dat is §8.3/9.3).
Tabs: `Huurders · Eigenaars`. ← Terug naar Dashboard.

### 5.1 Huurders
- Tabel: Appartement · Huurder · Huurperiode · **Voorschot / maand** (inline
  bewerkbaar) · vorig boekjaar (referentie) · opgelegd sinds.
- Enkel huurders met een huurperiode die in het gekozen boekjaar valt.
- Onder de tabel: "Overnemen van vorig boekjaar" (bulk).

### 5.2 Eigenaars
- Tabel: Appartement · Eigenaar · **Reservefonds / maand** (inline bewerkbaar) ·
  vorig boekjaar · AV-beslissing (vrij tekstveld/datum).
- Eén rij per appartement (voorschot_eigenaar is per unit).

Geen aparte opslag-knop per veld nodig als inline-edit direct opslaat; wel een
duidelijke bevestiging (toast).

---

## 6. Meterstanden  `/admin/meterstanden`  (§11)

**Doel:** verbruik per appartement vastleggen; bron voor afrekening + grafieken.
← Terug naar Dashboard.

### Layout
1. **Eenheidsprijzen dit boekjaar** (kaart): water €/m³ · mazout €/l · CV
   liter/m³ · warm water liter/m³. Knop "Mazoutprijs uit leveringen berekenen".
2. **Verbruik & controle** (kaart, per appartement):

| Teller | Beginstand (datum) | Eindstand (datum) | Verbruik | Kost |
|---|---|---|---:|---:|

   - Beginstand = automatisch de laatste stand vóór de boekjaarstart (vorig jaar).
   - "Verbruikskost dit boekjaar" per appartement + totaal blok.
   - Bij een **tussentijdse** stand: geëxtrapoleerde jaarkost vs. jaarvoorschot,
     met statusbadge.
3. **Standen invoeren** (per appartement): knop **+ Meterstand** → dialoog
   (datum begrensd op het boekjaar, aanleiding: eindstand / huurderwissel /
   tussentijds; waarde per teller). Lijst van bestaande standen met ✕.
4. Meternummers per teller inline bewerkbaar.

Verbruiksevolutie (§5.2) staat op het **Dashboard**, niet hier (geen duplicatie).

---

## 7. Afrekeningen  `/admin/afrekeningen`  (§12, §16–19)

**Doel:** de jaarafrekening — kern van de app. **Geen** voorschotcontrole meer
hier (§25). ← Terug naar Dashboard.

### 7.0 Kop
- Boekjaar + periode. Knop **Afrekeningen (her)berekenen** (maakt/actualiseert de
  voorstellen). Knop **Verstuur alle** (EmailJS). Status: laatst berekend op …

### 7.1 Overzicht huurders  (§17)

| Appartement | Huurder | Voorschotten | Verbruikskosten | Diverse kosten | Totaal kosten | Saldo | Mail |
|---|---|---:|---:|---:|---:|---:|---|

- Elk bedrag klikbaar → de betrokken deelpagina van de individuele afrekening.
- Rij (appartement) klikbaar → 7.3 individuele afrekening.
- Totaalrij onderaan.

### 7.2 Overzicht eigenaars  (nieuw, §12)

| Appartement | Eigenaar | Voorschotten (reservefonds) | Aandeel eigenaarskosten | Kapitaalopvragingen | Saldo | Mail |
|---|---|---:|---:|---:|---:|---|

### 7.3 Individuele afrekening huurder  `/afrekeningen/huurder/[id]`  (§16, §19)
- Kop: huurder · appartement · huurperiode binnen het boekjaar · e-mail.
- **Afrekeningstabel** (§16), uitbreidbaar per categorie:

| Onderdeel | Detail | Bedrag |
|---|---|---:|
| Totaal gestorte voorschotten | *(n betalingen)* | € … |
| Warm water | *… m³ × € …/m³* | € … |
| Koud water | *… m³ × € …/m³* | € … |
| Centrale verwarming | *… l stookolie × € …/l* | € … |
| Schoonmaak | *aandeel … /  jaar, pro rata … dagen* | € … |
| Onderhoud | *aandeel …* | € … |
| Administratie | *aandeel …* | € … |
| **Totaal kosten huurder** | | **€ …** |
| **Saldo** | terug te krijgen / bij te betalen | **€ …** |

- **Elke regel klikbaar** (§19):
  - Warm water → meterstand-detail (begin/eind/verbruik) + eenheidsprijs +
    onderliggende mazout/water-kosten + de banktransacties + facturen.
  - Schoonmaak → de schoonmaakkosten dit boekjaar → transacties → facturen.
  - Voorschotten → de stortingen van deze huurder op de zichtrekening.
- Knoppen: **PDF/afdrukken** · **Mailen** · **Bewaren** · ← Terug naar 7.1.

### 7.4 Individuele afrekening eigenaar  `/afrekeningen/eigenaar/[id]`
- Aandeel per eigenaarskostenpost volgens de verdeelsleutel (of gelijk), +
  reservefonds­provisies, + kapitaalopvragingen, saldo. Zelfde klikbaarheid.

---

## 8. Documenten  `/admin/documenten`  (§20)

← Terug naar Dashboard.
- Upload (meerdere bestanden) + categorie (notulen / factuur / contract /
  verzekering / bankbestand / afrekening / overig) + koppeling aan **boekjaar**
  en optioneel aan een **transactie**.
- Lijst gegroepeerd: *Dit boekjaar* · *Algemeen (hele VME)* · *Andere boekjaren*.

| Naam | Categorie | Boekjaar | Gekoppeld aan | Toegevoegd | Grootte | Acties |
|---|---|---|---|---|---:|---|

- "Gekoppeld aan" klikbaar → de transactie/kost.
- Bankbestanden verschijnen hier automatisch bij import (§20).

---

## 9. Instellingen  `/admin/instellingen`  (§21)

Eén pagina met tabs (of kaart-hub). ← Terug naar Dashboard. Alles wat hier staat
mag **nergens anders** ingevoerd worden (§21, §24).

| Tab | Inhoud |
|---|---|
| **VME** | naam, adres, IBAN zicht, IBAN spaar, aantal kavels |
| **Boekjaren** | lijst + status open/afgesloten, nieuw, verwijderen |
| **Appartementen** | lijst units, hernoemen, toevoegen/verwijderen |
| **Eigenaars** | per appartement: naam, e-mail (login), telefoon, IBAN |
| **Huurders** | per appartement: naam, e-mail, telefoon, IBAN, huurperiode |
| **Leveranciers** (§14) | naam, IBAN/mandaatreferte, naam-bevat, **standaard toewijzing** (huurder/eigenaar), **standaard verdeelwijze**, standaard verdeelsleutel |
| **Categorieën** (§18) | lijst kosten-/opbrengstcategorieën, groep (verbruik/divers/eigenaar), actief |
| **Verdeelsleutels** | naam + aandeel per appartement (matrix) |

---

## 10. Buildregels bij elke fase (§25, §26)

Checklist die elke PR afvinkt:
- [ ] Geen tweede scherm dat dezelfde data beheert (bv. voorschotcontrole enkel
      onder Kosten & Opbrengsten).
- [ ] Verplaatste functionaliteit → oude route wordt redirect, oude component
      verwijderd zodra alle links om zijn.
- [ ] Financiële tabellen gebruiken `FinancieleTabel` met de vaste kolomvolgorde.
- [ ] Elke sub-/detailpagina heeft ← Terug.
- [ ] Elk zichtbaar totaal is klikbaar naar zijn bron.
- [ ] Geen nieuwe kopie van transactie-/voorschot-/meterstand-data — enkel
      afgeleide views.
- [ ] Benamingen consistent (zicht/spaar, huurder/eigenaar, verbruik/divers).

---

## 11. Faseplanning gekoppeld aan dit document

| Fase | Schermen |
|---|---|
| **A** | 0.1 shell + menu, 1 routekaart (redirects), 6 rename, 9 Instellingen-hub, voorschotcontrole verplaatsen (4.2.3 / 4.3.3) en bij Afrekeningen weghalen |
| **B** | 0.2 `FinancieleTabel`, 2 datamodel (`kosten.rekening`, `categorie`), 4.2/4.3 Kosten & Opbrengsten, 5 Voorschotten opfrissen |
| **C** | 0.3/0.4 bedragkaarten + transactie-/kost-detail, 3 dashboard-drilldowns, 8 document↔transactie |
| **D** | 0.5 `EvolutieGrafiek`, dashboard §5 (10 jaar, metric- & scope-selector, kost/verbruik per categorie & appartement) |
| **E** | 7.3/7.4 individuele afrekeningen met volledige klik-traceerbaarheid, 7.2 eigenaars-overzicht |
| **F** | 10 opschoning: oude routes/componenten weg, tabel- en benaming-audit |
