# Functionele specificatie VME-app

> Centrale functionele specificatie voor de verdere ontwikkeling.
> Aangeleverd door Jan Timmermans — leidend voor alle nieuwe builds.

## 1. Doel van de applicatie

De applicatie maakt de financiële administratie en de jaarlijkse afrekening van
een VME zo eenvoudig, overzichtelijk en controleerbaar mogelijk.

De **jaarlijkse afrekening is de centrale functionaliteit**. Vanuit de
geïmporteerde bankbestanden, voorschotten, meterstanden, kosten, opbrengsten en
verdeelregels helpt de app de syndicus snel tot een correcte afrekening per
appartement te komen.

Tijdens de Algemene Vergadering geeft de app een duidelijk financieel overzicht
van de toestand en evolutie van de VME.

Uitgangspunt: **één gegeven wordt slechts één keer ingevoerd en opgeslagen en
wordt daarna overal hergebruikt.** Geen dubbele gegevens, invoerschermen of
functionaliteiten.

## 2. Hoofdmenu

Na het aanloggen ziet de gebruiker uitsluitend:

- Dashboard
- Kosten & Opbrengsten
- Voorschotten
- Meterstanden
- Afrekeningen
- Documenten
- Instellingen

Geen afzonderlijke hoofdmenu's voor bankbestanden, leveranciers, appartementen of
andere ondersteunende gegevens — die zitten in de bestaande hoofdmenu's.

## 3. Onderscheid tussen de twee VME-rekeningen

Doorheen de volledige applicatie strikt gescheiden:

- **Spaarrekening** = het kapitaal van de VME. Overal een afzonderlijke stroom.
- **Zichtrekening** = uitsluitend de werkrekening van de VME. Overal een
  afzonderlijke stroom.

Kosten, opbrengsten, voorschotten en saldi van beide rekeningen mogen niet
vermengd worden. Een gecombineerd totaal wordt **expliciet als gecombineerd**
aangeduid.

## 4. Dashboard

De financiële cockpit van de VME. Werkt standaard op het geselecteerde boekjaar
en de laatst geïmporteerde bankbestanden.

**4.1 Financieel overzicht** — inkomsten, uitgaven, saldo, evolutie t.o.v.
vorige boekjaren, belangrijke kosten, belangrijke opbrengsten, voorschotten,
relevante afwijkingen/evoluties.

**4.2 Spaarrekening – kapitaal VME** — blok met inkomsten, uitgaven, saldo.
Bedragen zijn **klikbaar** → detailpagina met de onderliggende transacties.

**4.3 Zichtrekening – werkrekening VME** — idem, klikbaar naar de onderliggende
transacties.

## 5. Dashboard: evolutie en trends

Toont ook de evolutie doorheen de tijd — voor de volledige VME/blok én per
individueel appartement.

**5.1 Dynamische grafieken** — de gebruiker selecteert de weergave:
spaarrekening (inkomsten / uitgaven / saldo) en zichtrekening (inkomsten /
uitgaven / saldo). Vergelijking met de historische boekjaren, tot **maximaal 10
jaar** terug indien beschikbaar.

**5.2 Kosten- en verbruiksevolutie** — dezelfde historische analyse voor o.a.
elektriciteit, water, verwarming, onderhoud, schoonmaak, administratie, andere
relevante kosten, en verbruik per appartement. Toont of kosten/verbruiken
structureel stijgen of dalen.

## 6. Klikbare gegevens en detailinformatie

Een eigenaar moet vanuit een totaalbedrag snel kunnen aantonen waaruit dat
bedrag bestaat. Klik op een bedrag → onderliggende informatie:
totaal → categorie → individuele transactie → gekoppelde factuur/document.

Geldt voor: inkomsten, uitgaven, voorschotten, verbruik, kosten per categorie,
kosten per appartement.

## 7. Kosten & Opbrengsten

Submenu's:

**7.1 Bankbestanden importeren** — duidelijk onderscheid bankbestand
zichtrekening vs. spaarrekening. De geïmporteerde transacties zijn dé bron voor
kosten, opbrengsten, betaalde voorschotten, saldi, afrekening, dashboard en
historische analyses. **Geen afzonderlijke kopieën** van transacties per
onderdeel.

## 8. Kosten & Opbrengsten – Zichtrekening

**8.1 Kosten zichtrekening** — overzicht van alle kosten geregistreerd vanuit de
zichtrekening.

**8.2 Opbrengsten zichtrekening** — overzicht van alle opbrengsten op de
zichtrekening.

**8.3 Voorschotcontrole huurders** — vergelijkt de opgelegde voorschotten van de
huurders met de effectief ontvangen betalingen op de zichtrekening. Toont per
huurder of hij pro rata op schema zit (op het geselecteerde boekjaar).

| Appartement | Te betalen | Betaald | Verschil | Status |
|---|---|---|---|---|
| 1.01 | € 1.200 | € 1.200 | € 0 | OK |
| 1.02 | € 1.200 | € 900 | -€ 300 | Achterstand |
| 2.01 | € 1.200 | € 1.300 | +€ 100 | Vooruit |

## 9. Kosten & Opbrengsten – Spaarrekening

**9.1 Kosten spaarrekening** · **9.2 Opbrengsten spaarrekening**

**9.3 Voorschotcontrole eigenaars** — vergelijkt de opgelegde voorschotten van
de eigenaars met de effectief ontvangen betalingen op de spaarrekening. Toont
per eigenaar of hij pro rata op schema zit.

## 10. Voorschotten

**10.1 Huurders** en **10.2 Eigenaars** — de opgelegde voorschotten bekijken,
wijzigen en opslaan. De betaalcontrole gebeurt niet door de gegevens opnieuw in
te voeren, maar door de voorschotten te vergelijken met de geïmporteerde
banktransacties.

## 11. Meterstanden

Alle individuele verbruiksgegevens (koud water, warm water, centrale verwarming,
andere meters). Bepaalt het werkelijke verbruik per appartement voor de
jaarlijkse afrekening en de historische analyses.

Verbruikslogica: meterstand vorig jaar → meterstand huidig jaar → werkelijk
verbruik → aandeel in de relevante kosten → afrekening appartement.

Meterstanden worden slechts één keer ingevoerd en daarna overal hergebruikt.

## 12. Afrekeningen

De basisfunctionaliteit. De app maakt zoveel mogelijk automatisch een
**voorstel** tot afrekening uit: bankbestanden, transacties, kosten, opbrengsten,
voorschotten, meterstanden, leveranciersconfiguratie, verdeelregels, gegevens van
appartementen en huurders/eigenaars. De syndicus controleert en corrigeert vóór
de afrekening definitief wordt.

## 13. Kosten classificeren

Bij het analyseren van banktransacties classificeert de app kosten:
toewijzing aan **eigenaar** of **huurder**, en de **verdeelmethode**
(pro rata per appartement, volgens meterstand/verbruik, of een andere
verdeelsleutel). De automatische classificatie is altijd een voorstel; de
syndicus kan elke classificatie aanpassen.

## 14. Leveranciers configureren

Onder Instellingen: per leverancier standaard-toewijzing (eigenaar/huurder),
standaard verdeelwijze en aanvullende regels.

| Leverancier | Toewijzing | Verdeelwijze |
|---|---|---|
| Waterleverancier | Huurder | Meterstand |
| Verwarming | Huurder | Meterstand |
| Schoonmaak | Huurder | Pro rata |
| Lift onderhoud | Eigenaar | Ingestelde verdeelsleutel |
| Verzekering | Eigenaar | Ingestelde verdeelsleutel |

Bij een nieuwe transactie van een bekende leverancier stelt de app deze
classificatie automatisch voor. Een individuele correctie wijzigt niet
noodzakelijk de algemene leveranciersconfiguratie.

## 15. Verdeling van kosten voor huurders

Standaard evenredig over het aantal appartementen (€ 1.000 / 20 = € 50 per
appartement). Uitzondering: kosten op basis van werkelijk verbruik (warm water,
koud water, centrale verwarming, mazout, gas, andere gemeten verbruiken). Per
kost bepaalt de app de verdeelwijze; de syndicus kan die controleren en
aanpassen.

## 16. Afrekening per huurder

Per huurder, voor het geselecteerde boekjaar, minimaal:

| Onderdeel | Bedrag |
|---|---|
| Totaal gestorte voorschotten | € … |
| Warm water | € … |
| Koud water | € … |
| Centrale verwarming | € … |
| Schoonmaak | € … |
| Onderhoud | € … |
| Administratie | € … |
| Totaal kosten huurder | € … |
| Saldo | € … |

Berekening: totaal gestorte voorschotten − totale kosten = saldo. Positief =
terugbetaling, negatief = bijbetaling.

## 17. Overzicht afrekening alle huurders

| Appartement | Voorschotten | Verbruikskosten | Diverse kosten | Totaal kosten | Saldo |
|---|---|---|---|---|---|
| 1.01 | € 2.400 | € 1.250 | € 900 | € 2.150 | +€ 250 |
| 1.02 | € 2.400 | € 1.480 | € 920 | € 2.400 | € 0 |
| 2.01 | € 2.400 | € 1.620 | € 950 | € 2.570 | -€ 170 |

Klik op een appartement → volledige individuele afrekening. Individuele bedragen
zijn klikbaar naar de onderliggende gegevens.

## 18. Afrekening: kostenstructuur

Huurderskosten minstens opgesplitst in:

- **Verbruikskosten**: warm water, koud water, centrale verwarming
- **Diverse kosten**: schoonmaak, onderhoud, administratie, andere als huurder
  geclassificeerde kosten

De categorieën moeten uitbreidbaar zijn.

## 19. Afrekening en controleerbaarheid

Elke belangrijke berekening is traceerbaar tot op de oorspronkelijke gegevens:
totaal warm water 1.01 → verbruik appartement → toegepaste verdeelsleutel →
relevante kosten → oorspronkelijke banktransacties → gekoppelde
facturen/documenten.

## 20. Documenten

Centrale plaats voor VME-documenten: bankbestanden, facturen,
leveranciersdocumenten, afrekeningen, AV-documenten, andere. Waar mogelijk
gekoppeld aan de relevante financiële gegevens (een transactie kan een gekoppelde
factuur bevatten).

## 21. Instellingen

Centrale configuratie: VME-gegevens, boekjaren, appartementen, eigenaars,
huurders, leveranciers, kosten- en opbrengstcategorieën, verdeelregels,
leveranciersregels, algemene instellingen. Wordt centraal beheerd en mag nergens
anders opnieuw ingevoerd worden.

## 22. Consistente tabellen

Alle tabellen dezelfde structuur en lay-out (vooral financiële): zelfde
headerstijl, uitlijning, benamingen, datumweergave; bedragen rechts, tekst links;
totalen herkenbaar; zelfde sorteren/filteren; zelfde visuele behandeling van
klikbare gegevens.

Standaardkolommen financiële transacties:

| Datum | Omschrijving | Leverancier / Tegenpartij | Categorie | Rekening | Bedrag |

De kolomvolgorde wordt doorheen de app aangehouden.

## 23. Navigatie

Overal een eenvoudige **← Terug**-knop. De gebruiker moet niet telkens via het
hoofdmenu terug navigeren. Consistent op alle pagina's.

## 24. Eén bron van waarheid

Een banktransactie wordt slechts één keer opgeslagen en gebruikt door dashboard,
Kosten & Opbrengsten, voorschottencontrole, afrekeningen, grafieken,
detailpagina's, rapporten. Idem voor voorschotten, meterstanden, leveranciers,
appartementen, huurders, eigenaars, documenten. Geen dubbele gegevens.

## 25. Geen dubbele functionaliteit

Bij elke build controleren op dubbele functionaliteit. Bij verplaatsing wordt de
oude versie verwijderd. Voorbeeld: de voorschotcontrole hoort onder
Kosten & Opbrengsten → Zicht/Spaar en mag **niet** ook nog onder Afrekeningen
blijven.

## 26. Build-regel: opschonen

Elke build controleert op: dubbele gegevens, invoervelden, tabellen,
instellingen, berekeningen, functionaliteiten; oude menu-items, pagina's, links,
componenten; inconsistenties in kolomstructuur en benamingen. Twee plaatsen die
dezelfde info beheren → terug naar één centrale bron.

## 27. Centrale gegevensstroom

```
BANKBESTANDEN
     ├── Zichtrekening → Kosten · Opbrengsten · Voorschotten huurders
     └── Spaarrekening → Kosten · Opbrengsten · Voorschotten eigenaars
METERSTANDEN
     ↓
KOSTENCLASSIFICATIE → VERDEELREGELS → JAARAFREKENING (per appartement · per huurder/eigenaar)
     ↓
DASHBOARD → Grafieken & historische vergelijkingen
```

## 28. Ontwerpprincipes

1. Spaar- en zichtrekening altijd strikt gescheiden (spaar = kapitaal, zicht =
   werkrekening).
2. De bankfiles zijn dé bron voor kosten, opbrengsten, voorschotten en saldi.
3. De jaarlijkse afrekening is de centrale functionaliteit.
4. Kosten worden aan huurders of eigenaars toegewezen.
5. De syndicus controleert en kan elk automatisch voorstel aanpassen.
6. Leveranciers vooraf configureerbaar voor automatische classificatie.
7. Huurderskosten standaard pro rata, tenzij een andere verdeelsleutel (bv.
   meterverbruik).
8. Meterstanden centraal opgeslagen en hergebruikt.
9. Voorschotcontrole huurders via de zichtrekening, eigenaars via de
   spaarrekening.
10. Dashboard geeft de AV in één oogopslag een duidelijk beeld.
11. Belangrijke totalen klikbaar tot op de onderliggende transactie.
12. Kosten en verbruiken historisch vergelijkbaar (VME én per appartement).
13. Tabellen: één vaste structuur en kolomvolgorde.
14. Overal een eenvoudige Terug-knop.
15. Gegevens slechts één keer opgeslagen; functionaliteit slechts één keer
    aangeboden. Elke build verwijdert dubbele/verouderde functionaliteit.

## Einddoel

Van **bankbestanden + voorschotten + meterstanden** naar een **gecontroleerde
jaarlijkse afrekening per appartement** met zo weinig mogelijk manuele
handelingen, waarbij elke berekening volledig controleerbaar is en het dashboard
de VME tijdens de AV in één oogopslag haar financiële situatie, kosten,
opbrengsten, voorschotten, verbruiken en evolutie toont.
