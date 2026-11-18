"use client";

import { useState } from "react";
import type { Eenheidsprijs } from "@/lib/types";
import { EENHEIDSPRIJS_DEFAULTS } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { mazoutprijsUitLeveringen, setTarieven } from "./actions";

const tekst = (n: number | null | undefined) => (n != null ? String(n) : "");

function Sectie({
  titel,
  uitleg,
  children,
}: {
  titel: string;
  uitleg?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">{titel}</h3>
        {uitleg && <p className="text-xs text-muted-foreground">{uitleg}</p>}
      </div>
      {children}
    </section>
  );
}

export function TarievenForm({
  vmeId,
  boekjaarId,
  huidig,
}: {
  vmeId: string;
  boekjaarId: string;
  huidig: Partial<Eenheidsprijs> | null;
}) {
  const d = { ...EENHEIDSPRIJS_DEFAULTS, ...(huidig ?? {}) };
  const [volume, setVolume] = useState(tekst(huidig?.water_basisvolume_m3));
  const [personen, setPersonen] = useState("");
  const voorstel =
    personen.trim() !== "" && Number(personen) >= 0
      ? 30 + 30 * Math.floor(Number(personen))
      : null;

  return (
    <div className="space-y-4">
      <ActionForm
        action={setTarieven}
        hiddenFields={{ vme_id: vmeId, boekjaar_id: boekjaarId }}
        className="space-y-4"
      >
        <Sectie
          titel="Water"
          uitleg="Basis- en comforttarief van De Watergroep (incl. btw). Tot het basisvolume betaal je het basistarief, daarboven het comforttarief."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Basisvolume gebouw (m³/jaar)"
              name="water_basisvolume_m3"
              inputMode="decimal"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              hint="Hoeveel m³ per jaar aan het basistarief vallen (één aansluiting, gelijk verdeeld over de appartementen). Leeg = vaste prijs."
            />
            <Field
              label="Basistarief (€/m³ incl. btw)"
              name="water_basis_per_m3"
              inputMode="decimal"
              defaultValue={tekst(huidig?.water_basis_per_m3)}
              hint="(drinkwater + afvoer + zuivering) × 1,06"
            />
            <Field
              label="Comforttarief (€/m³ incl. btw)"
              name="water_comfort_per_m3"
              inputMode="decimal"
              defaultValue={tekst(huidig?.water_comfort_per_m3)}
              hint="Leeg = 2 × het basistarief."
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-md bg-muted/40 p-3">
            <div className="space-y-1.5">
              <label htmlFor="personen" className="text-sm font-medium">
                Hulp: aantal gedomicilieerden
              </label>
              <input
                id="personen"
                inputMode="numeric"
                value={personen}
                onChange={(e) => setPersonen(e.target.value)}
                placeholder="bv. 8"
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {voorstel != null
                ? `30 m³ per aansluiting + 30 m³ per gedomicilieerde = ${voorstel} m³.`
                : "De Watergroep rekent 30 m³ per aansluiting + 30 m³ per gedomicilieerde. Controleer het exacte basisvolume op de factuur."}
            </p>
            {voorstel != null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVolume(String(voorstel))}
              >
                Gebruik {voorstel} m³
              </Button>
            )}
          </div>
          <Field
            label="Vaste waterprijs (€/m³) — als geen basis-/comforttarief is ingevuld"
            name="prijs_water_per_m3"
            inputMode="decimal"
            defaultValue={String(d.prijs_water_per_m3)}
            className="sm:max-w-xs"
          />
        </Sectie>

        <Sectie
          titel="Stookolie"
          uitleg="Stookolie = (Δ CV × liter/m³ + Δ warm water × liter/m³) × mazoutprijs."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Mazoutprijs (€/liter)"
              name="mazoutprijs_per_liter"
              inputMode="decimal"
              defaultValue={String(d.mazoutprijs_per_liter)}
            />
            <Field
              label="CV → liter per eenheid"
              name="cv_liter_per_m3"
              inputMode="decimal"
              defaultValue={String(d.cv_liter_per_m3)}
            />
            <Field
              label="Warm water → liter per m³"
              name="warmwater_liter_per_m3"
              inputMode="decimal"
              defaultValue={String(d.warmwater_liter_per_m3)}
            />
          </div>
        </Sectie>

        <Sectie
          titel="Doorrekening aan de huurders"
          uitleg="Percentages van 0 tot 100. Met 0 % wordt de kost niet aan de huurders doorgerekend."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Syndicuskosten doorgerekend aan huurders (%)"
              name="syndicus_pct_huurders"
              inputMode="decimal"
              defaultValue={String(d.syndicus_pct_huurders ?? 0)}
              hint="Geldt voor alle kosten met categorie 'syndicus'. Het resterende deel blijft bij de eigenaars. 0 = niets doorrekenen."
            />
            <Field
              label="Administratiekost VME (%)"
              name="administratie_pct"
              inputMode="decimal"
              defaultValue={String(d.administratie_pct ?? 0)}
              hint="Extra % bovenop het eigen verbruik + aandeel gedeelde kosten van de huurder."
            />
          </div>
        </Sectie>

        <SubmitButton>Opslaan</SubmitButton>
      </ActionForm>

      <ActionForm
        action={mazoutprijsUitLeveringen}
        hiddenFields={{ vme_id: vmeId, boekjaar_id: boekjaarId }}
      >
        <SubmitButton variant="outline" size="sm">
          Mazoutprijs berekenen uit leveringen dit boekjaar
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
