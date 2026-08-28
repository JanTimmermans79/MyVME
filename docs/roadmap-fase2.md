# MyVME — Fase 2 & 3: uitgebreide afrekening

Status: **in uitvoering**. Fase 1 (MVP) draait op productie.
Dit document is de werkspec; het wordt bijgewerkt naarmate beslissingen vallen.

## Doel

Volwaardige jaarafrekening en tussentijdse (pro-rata) afrekening per **huurder**
en per **eigenaar**, met individueel verbruik (tellers) + gedeelde kosten uit de
bankimport, en slimme IBAN-matching van betalingen.

---

## Datamodel-uitbreidingen

### Personen & rekeningen
- `huurder`: `+ voornaam`, `+ iban`
- `eigenaar`: `+ iban`
- **nieuw** `bankrelatie` — per VME configureerbare tegenpartij:
  `naam, iban, type (leverancier | eigen_rekening | overig),
   standaard_categorie, standaard_verdeelsleutel_id, standaard_betaler_type`

### Bank
- `transactie`: `+ tegenpartij_iban`
- matching-volgorde: **IBAN** → structuurcode-prefix → naamgelijkenis (suggestie) → onbevestigd

### Tellers & verbruik
- **nieuw** `teller` — per unit: `type (warm_water | koud_water | cv), meternummer`
- **nieuw** `meterstand` — `teller_id, datum, waarde,
   aanleiding (boekjaareinde | huurderwissel | tussentijds), huurder_id?`
- **nieuw** `eenheidsprijs` — per VME + boekjaar:
  `prijs_koud_water (€/m³), prijs_warm_water (€/m³), prijs_stookolie (€/eenheid)`

### Voorschotten (herwerkt)
- `voorschot_eigenaar` — per unit, per boekjaar, `bedrag_per_maand` (AV-beslissing)
- `voorschot_huurder` — per huurder, per boekjaar, `bedrag_per_maand` (variabel)

### Facturen ↔ betalingen
- `kosten`: `+ betaald_met_transactie_id` (uitgaande betaling op de zichtrekening)

### Afrekening (detail)
- **nieuw** `afrekening_lijn` — `afrekening_id, type, omschrijving,
   hoeveelheid, eenheidsprijs, bedrag`

---

## Rekenlogica (huurder, periode = `[max(boekjaarstart, huurdatum) → min(boekjaareinde, vertrekdatum)]`)

Alle tellers in **m³**. Instelbaar per VME + boekjaar (met defaults):

| Parameter | Default | Bron |
|---|---|---|
| `prijs_water_per_m3` | 6,51 €/m³ | vast ingeven (Watergroep) — geldt voor koud én warm |
| `mazoutprijs_per_liter` | 0,81 €/l | vast ingeven **of** knop "bereken uit leveringen dit boekjaar" (gewogen gemiddelde van `mazout_levering`) |
| `cv_liter_per_m3` | 0,20 l/m³ | omzetting CV-teller → stookolie |
| `warmwater_liter_per_m3` | 1,00 l/m³ | omzetting warm water → stookolie |

| Post | Formule |
|---|---|
| Koud water | Δ m³ × `prijs_water_per_m3` |
| Warm water | Δ m³ × `prijs_water_per_m3` |
| Stookolie (liter) | Δ CV m³ × `cv_liter_per_m3` + Δ warm water m³ × `warmwater_liter_per_m3` |
| Stookolie (€) | liter × `mazoutprijs_per_liter` |
| Gedeelde kosten | (Σ gedeelde kosten uit bankimport ÷ `vme.aantal_kavels`) × (bewoningsdagen ÷ dagen in boekjaar) |
| Voorschotten (verwacht) | `voorschot_huurder.bedrag_per_maand` × maanden in periode |
| Voorschotten (ontvangen) | Σ gematchte betalingen van de huurder in de periode |
| **Saldo** | ontvangen − (koud + warm + stookolie + aandeel gedeelde kosten) |

Als `|ontvangen − verwacht| > drempel` → **rode waarschuwing** in het overzicht.

Meterstand-begin = stand einde vorig boekjaar, **tenzij** huurderwissel → stand bij
afrekening vorige huurder (`meterstand.aanleiding = 'huurderwissel'`).

Gedeelde kosten (volledig naar huurders): elektriciteit, schoonmaak, water
onderhoud, diverse — opgeteld uit de bankimport per categorie.

---

## Beslissingen (BEVESTIGD 2026-08-28)

1. **Vast ingeven per boekjaar.** Water 6,51 €/m³ (koud = warm). Mazout 0,81 €/l default, instelbaar of af te leiden uit de leveringen.
2. **CV-teller in m³.** 1 m³ CV = 0,20 l stookolie; 1 m³ warm water = 1 l stookolie (beide instelbaar).
3. **Gedeelde kosten volledig naar de huurders.**
4. **Gelijk per appartement** (totaal ÷ `vme.aantal_kavels`), daarna pro rata bewoningsdagen.
5. **Voorschot-config handmatig**, import dient ter controle; afwijking = rode melding.
6. **Naam + voornaam ook bij de eigenaar.**
7. **1 betaling ↔ 1 factuur** (`kosten.betaald_met_transactie_id`).

---

## Bouwvolgorde

- [x] **2a** — huurder (voornaam, iban) + eigenaar-iban + `transactie.tegenpartij_iban` + IBAN-matching in de import + admin-huurderbeheer
- [x] **2b** — `bankrelatie` (configureerbare tegenpartijen) — CRUD klaar; import-integratie (auto-kosten uit betaling) volgt met 2f
- [x] **2c** — voorschotten herwerken (eigenaar per boekjaar, huurder per huurder/boekjaar)
- [x] **2d** — tellers + meterstanden + eenheidsprijzen
- [x] **2e** — verbruiksberekening + `afrekening_lijn` + pro-rata + huurder-detail + mailen
- [ ] **2f** — factuur-upload ↔ uitgaande betaling matchen; bankrelatie-import maakt kosten-voorstel
- [x] **2g — KBC PDF-import + `transactie.soort`/`rekening` + voorschotcontrole** (migr. 20260828140000). Parser getest tegen echte zicht- + spaarrekening, saldo klopt.
- [ ] **polish** — admin-nav groeperen (15 items); owner-dashboard huurderafrekening tonen; PDF/print van de afrekening; reconciliatie totaal water/mazout (bankfactuur vs som meterverbruik)

Elk blok = aparte migratie + commit, getest en gedeployed.

---

## Blok 2g — KBC-zichtrekening PDF verwerken

Getest tegen een echte KBC "Export KBC Touch" PDF (VME Mooi Zicht, boekjaar
31-10-2024 → 01-11-2025, 104 verrichtingen). Volledig parseerbaar: het
eindsaldo klopt tot op de cent (3122,59 + −774,87 = 2347,72).

Nodig om zo'n PDF 100% te verwerken:

1. **PDF-parser** voor het KBC Touch-formaat. Blok per verrichting:
   `DD-MM-YYYY<naam><bedrag>` + `Rekeningnummer/IBAN`, `BIC`, `Mededeling`,
   evt. `Referte schuldeiser` + `Mandaatreferte` (domiciliëring, géén IBAN),
   `Tijdstip`, transactietype. Pagina-headers/-footers strippen.
2. **`transactie.soort`** enum: `voorschot | afrekening | kost |
   interne_overboeking | terugbetaling | overig`. Enkel `voorschot` telt mee
   in de voorschot-matching. Import raadt de soort uit:
   - mededeling bevat "VOORSCHOT" → voorschot
   - mededeling bevat "AFREKENING"/"EINDAFREKENING" → afrekening (vorig boekjaar,
     niet meetellen)
   - tegenpartij_iban ∈ {`vme.iban`, `vme.iban_reserve`} → interne_overboeking
   - tegenpartij_iban matcht een `bankrelatie` type leverancier → kost
   - admin kan de soort altijd corrigeren
3. **Auto interne overboeking**: transfers van/naar de spaarrekening
   (bv. +26.000 "VOOR GEVELRENOVATIE") tellen niet als inkomen.
4. **Import → kosten-voorstel**: uitgaande betaling naar een geconfigureerde
   leverancier-IBAN → `kosten` met `status='voorstel'` +
   `betaald_met_transactie_id`, admin bevestigt (samen met 2f).
5. **`bankrelatie.mandaatreferte`**: matchen van domiciliëringen zonder IBAN
   (bv. Eneco, mandaat 61000001597504).
6. Persoon met meerdere rekeningen (voorschot-IBAN vs onkosten-IBAN): meerdere
   `bankrelatie`-rijen, of extra `eigenaar_iban`/`huurder_iban`-tabel. Voor nu:
   losse bankrelatie-rijen volstaan.

### Twee-rekeningenmodel (bevestigd via de spaarrekening-PDF)

- **Zichtrekening** (`vme.iban`): bewoners storten hier hun *voorschot
  gemeenschappelijke kosten* (huurders + eigenaar-bewoners). Leveranciers worden
  hiervan betaald. **Geen huurgelden** — die gaan rechtstreeks naar de eigenaars.
- **Spaarrekening** (`vme.iban_reserve`): elke eigenaar stort hier zijn
  *maandelijkse reservefonds-provisie* (bv. €200), 12× per boekjaar. Grote werken
  worden hiervan betaald; eenmalige bijdragen = `soort='kapitaalsoproep'`.
- Een **eigenaar-bewoner** (bv. Jo Vrancken) betaalt béide: reservefonds op de
  spaarrekening + voorschot gemeenschappelijke kosten op de zichtrekening. Hij
  wordt in de jaarafrekening als bewoner behandeld (verbruik + gedeelde kosten),
  maar betaalt geen huur. Modelleer hem als eigenaar én als huurder van de eigen
  unit met dezelfde IBAN — de `rekening` van de verrichting maakt het onderscheid.
- De import zet `soort='afrekening'` op "AFREKENING 2024"-betalingen (settlement
  vorig boekjaar) → tellen niet mee.

### Wat de testdata leert over het model

| Rol | Voorbeeld | IBAN | Patroon |
|---|---|---|---|
| Eigenaar-voorschot | VRANCKEN JO | BE52 7353 1720 1809 | €157,50/mnd "VOORSCHOT GEMEENSCHAPPELIJKE KOSTEN" |
| Eigenaar-voorschot | MACHIELS MANDY | BE61 0636 7074 3517 | €150 → €200/mnd (verhoogd op AV) |
| Eigenaar-voorschot | PATRICK CROUGHS | BE81 9730 9032 5424 | €170 → €100/mnd + EINDAFREKENING (verkocht mid-boekjaar) |
| Huurder | STEVENS WESLEY | BE39 7350 2427 2519 | €300/mnd, mededeling = maandnaam |
| Vorig-jaar afrekening | −1194,17 / −231,41 / +417,36 | — | "AFREKENING 2024" — niet meetellen in 2024-2025 |
| Interne overboeking | van reservefonds | BE84 7450 5726 7859 (= `vme.iban_reserve`) | +26.000 + +1.210 om grote facturen te dekken |
| Leverancier water | WATERGROEP / VMW HOOFDDIRECTIE | BE90 0969 2800 0132 | 2 namen, 1 IBAN; terugbetaling via andere IBAN |
| Leverancier elektr. | ENI GAS EN POWER + Eneco (domiciliëring) | BE50 0018 1567 6918 / geen | domiciliëring heeft enkel mandaatreferte |
| Leverancier mazout | KOEN VOETS MAZOUT | BE45 1030 5132 4889 | "FAKTUUR 252127" |
| Grote werken | GEVELCO | BE81 0014 5246 1024 | −25.996,24 gevelrenovatie, uit reservefonds |
| Schoonmaak | VRANCKEN (JO/ELS) | BE73 2300 0483 4660 | "POETS <maanden>" + materiaal |
| Syndicus | TIMMERMANS JAN | BE33 7353 1702 1246 | €40/mnd "SYNDIC <maand>" |
| Bankkosten | Verbruik/Bijdrage KBC | geen IBAN | −250 + −28,50 |
