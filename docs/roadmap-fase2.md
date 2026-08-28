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

- [ ] **2a** — huurder (voornaam, iban) + eigenaar-iban + `transactie.tegenpartij_iban` + IBAN-matching in de import + admin-huurderbeheer
- [ ] **2b** — `bankrelatie` (configureerbare tegenpartijen) → import categoriseert automatisch
- [ ] **2c** — voorschotten herwerken (eigenaar per boekjaar, huurder per huurder/boekjaar)
- [ ] **2d** — tellers + meterstanden + eenheidsprijzen
- [ ] **2e** — verbruiksberekening + `afrekening_lijn` + pro-rata + huurder-overzicht
- [ ] **2f** — factuur ↔ betaling matching

Elk blok = aparte migratie + commit, getest en gedeployed.
