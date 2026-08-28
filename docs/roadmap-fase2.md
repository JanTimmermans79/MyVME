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

| Post | Formule |
|---|---|
| Koud water | Δ m³ × prijs koud water |
| Warm water | Δ m³ × prijs warm water |
| Stookolie | (Δ CV-teller + Δ warm water m³) × prijs stookolie |
| Gedeelde kosten | som uit bankimport × aandeel verdeelsleutel, **pro rata bewoningsdagen** |
| Voorschotten | som gematchte betalingen van de huurder in de periode |
| **Saldo** | voorschotten − (individueel verbruik + aandeel gedeelde kosten) |

Meterstand-begin = stand einde vorig boekjaar, **tenzij** huurderwissel → stand bij
afrekening vorige huurder.

---

## Open beslissingen (nodig vóór blok 2d/2e)

1. Prijs stookolie/water: vast per boekjaar ingegeven **of** berekend (totale kost ÷ totaal verbruik)? Koud- en warmwaterprijs gelijk of apart?
2. Eenheid van de CV-teller (m³ / kWh / liter / tik)?
3. Gedeelde kosten: volledig naar huurders, of split eigenaar/huurder per categorie?
4. Welke verdeelsleutel voor de gedeelde kosten (gelijk per app. of quotiteiten)?
5. Voorschot-config automatisch uit de import afleiden, of blijft config handmatig en dient de import enkel om te matchen?
6. Naam/voornaam splitsen ook bij de eigenaar? → **voorlopige keuze: enkel huurder** (eigenaar houdt `naam`)
7. Eén betaling ↔ één factuur, of kan één overschrijving meerdere facturen dekken?

---

## Bouwvolgorde

- [ ] **2a** — huurder (voornaam, iban) + eigenaar-iban + `transactie.tegenpartij_iban` + IBAN-matching in de import + admin-huurderbeheer
- [ ] **2b** — `bankrelatie` (configureerbare tegenpartijen) → import categoriseert automatisch
- [ ] **2c** — voorschotten herwerken (eigenaar per boekjaar, huurder per huurder/boekjaar)
- [ ] **2d** — tellers + meterstanden + eenheidsprijzen
- [ ] **2e** — verbruiksberekening + `afrekening_lijn` + pro-rata + huurder-overzicht
- [ ] **2f** — factuur ↔ betaling matching

Elk blok = aparte migratie + commit, getest en gedeployed.
