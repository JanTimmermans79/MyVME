"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Eenheidsprijs, Huurder, Teller } from "@/lib/types";
import { EENHEIDSPRIJS_DEFAULTS } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  maakTellers,
  setMeternummer,
  nieuweMeterstanden,
  updateMeterstanden,
  verwijderMeterstand,
  setEenheidsprijs,
  mazoutprijsUitLeveringen,
} from "./actions";

const TYPE_LABEL: Record<string, string> = {
  koud_water: "Koud water",
  warm_water: "Warm water",
  cv: "CV / verwarming",
};

const AANLEIDING_OPTIES = [
  { value: "boekjaareinde", label: "Einde boekjaar" },
  { value: "huurderwissel", label: "Huurderwissel" },
  { value: "tussentijds", label: "Tussentijds" },
];

export function EenheidsprijsForm({
  vmeId,
  boekjaarId,
  huidig,
}: {
  vmeId: string;
  boekjaarId: string;
  huidig: Eenheidsprijs | null;
}) {
  const d = huidig ?? EENHEIDSPRIJS_DEFAULTS;
  return (
    <div className="space-y-3">
      <ActionForm
        action={setEenheidsprijs}
        hiddenFields={{ vme_id: vmeId, boekjaar_id: boekjaarId }}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field
          label="Water (€/m³)"
          name="prijs_water_per_m3"
          inputMode="decimal"
          defaultValue={String(d.prijs_water_per_m3)}
        />
        <Field
          label="Mazout (€/liter)"
          name="mazoutprijs_per_liter"
          inputMode="decimal"
          defaultValue={String(d.mazoutprijs_per_liter)}
        />
        <Field
          label="CV → liter/m³"
          name="cv_liter_per_m3"
          inputMode="decimal"
          defaultValue={String(d.cv_liter_per_m3)}
        />
        <Field
          label="Warm water → liter/m³"
          name="warmwater_liter_per_m3"
          inputMode="decimal"
          defaultValue={String(d.warmwater_liter_per_m3)}
        />
        <Field
          label="Administratiekost VME (%)"
          name="administratie_pct"
          inputMode="decimal"
          defaultValue={String(d.administratie_pct ?? 0)}
        />
        <div className="sm:col-span-2 lg:col-span-4 space-y-1">
          <SubmitButton>Opslaan</SubmitButton>
          <p className="text-xs text-muted-foreground">
            Het administratiepercentage wordt in de huurdersafrekening op het
            eigen verbruik + aandeel gedeelde kosten gerekend. 0 % = niet
            doorrekenen.
          </p>
        </div>
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

export function MaakTellersButton({ unitId }: { unitId: string }) {
  return (
    <ActionForm action={maakTellers} hiddenFields={{ unit_id: unitId }}>
      <SubmitButton size="sm" variant="outline">
        Tellers aanmaken
      </SubmitButton>
    </ActionForm>
  );
}

export function MeternummerRij({ teller }: { teller: Teller }) {
  return (
    <ActionForm
      action={setMeternummer}
      hiddenFields={{ id: teller.id }}
      className="flex items-center gap-2"
    >
      <span className="w-32 text-sm">{TYPE_LABEL[teller.type]}</span>
      <Input
        name="meternummer"
        placeholder="meternummer"
        defaultValue={teller.meternummer ?? ""}
        className="h-8 w-44"
      />
      <SubmitButton size="sm" variant="ghost">
        Opslaan
      </SubmitButton>
    </ActionForm>
  );
}

export function NieuweMeterstandDialog({
  unitId,
  unitNaam,
  tellers,
  huurders,
  boekjaarStart,
  boekjaarEind,
}: {
  unitId: string;
  unitNaam: string;
  tellers: Teller[];
  huurders: Huurder[];
  boekjaarStart: string;
  boekjaarEind: string;
}) {
  const [open, setOpen] = useState(false);
  const heeft = new Set(tellers.map((t) => t.type));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={tellers.length === 0}>
          <Plus className="size-3.5" /> Meterstanden
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meterstanden — {unitNaam}</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={nieuweMeterstanden}
          hiddenFields={{
            unit_id: unitId,
            boekjaar_start: boekjaarStart,
            boekjaar_eind: boekjaarEind,
          }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Datum"
              name="datum"
              type="date"
              required
              min={boekjaarStart}
              max={boekjaarEind}
              defaultValue={boekjaarEind}
            />
            <div className="space-y-1.5">
              <Label htmlFor="aanleiding">Aanleiding</Label>
              <Select name="aanleiding" defaultValue="boekjaareinde">
                <SelectTrigger id="aanleiding" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boekjaareinde">Einde boekjaar</SelectItem>
                  <SelectItem value="huurderwissel">Huurderwissel</SelectItem>
                  <SelectItem value="tussentijds">Tussentijds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {huurders.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="huurder_id">Huurder (bij huurderwissel)</Label>
              <Select name="huurder_id">
                <SelectTrigger id="huurder_id" className="w-full">
                  <SelectValue placeholder="(geen)" />
                </SelectTrigger>
                <SelectContent>
                  {huurders.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {[h.voornaam, h.naam].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {(["koud_water", "warm_water", "cv"] as const).map((t) =>
              heeft.has(t) ? (
                <Field
                  key={t}
                  label={`${TYPE_LABEL[t]} (m³)`}
                  name={`waarde_${t}`}
                  inputMode="decimal"
                />
              ) : null,
            )}
          </div>
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

export interface StandGroepItem {
  type: string;
  id: string;
  waarde: number;
}

/** Klikbare rij die een bestaande opname (datum + 3 tellers) laat aanpassen. */
export function EditMeterstandGroep({
  unitNaam,
  datum,
  aanleiding,
  huurderId,
  items,
  huurders,
  boekjaarStart,
  boekjaarEind,
}: {
  unitNaam: string;
  datum: string;
  aanleiding: string;
  huurderId: string | null;
  items: StandGroepItem[];
  huurders: Huurder[];
  boekjaarStart: string;
  boekjaarEind: string;
}) {
  const [open, setOpen] = useState(false);
  const waardeVan = (type: string) =>
    items.find((i) => i.type === type)?.waarde ?? null;
  const idVan = (type: string) => items.find((i) => i.type === type)?.id ?? null;
  const alleIds = items.map((i) => i.id).join(",");
  const datumKort = new Date(`${datum}T00:00:00Z`).toLocaleDateString("nl-BE");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs tabular-nums hover:bg-muted"
        >
          <span className="w-20 text-muted-foreground">{datumKort}</span>
          {(["koud_water", "warm_water", "cv"] as const).map((t) => {
            const w = waardeVan(t);
            return (
              <span key={t} className="w-24">
                {w != null ? `${w} m³` : "—"}
              </span>
            );
          })}
          <Badge variant="secondary" className="px-1 py-0 text-[10px]">
            {aanleiding}
          </Badge>
          <span className="ml-auto text-muted-foreground">bewerken →</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opname aanpassen — {unitNaam}</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateMeterstanden}
          hiddenFields={{
            boekjaar_start: boekjaarStart,
            boekjaar_eind: boekjaarEind,
            ...Object.fromEntries(
              (["koud_water", "warm_water", "cv"] as const)
                .map((t) => [`id_${t}`, idVan(t)])
                .filter(([, v]) => v) as [string, string][],
            ),
          }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Datum"
              name="datum"
              type="date"
              required
              min={boekjaarStart}
              max={boekjaarEind}
              defaultValue={datum}
            />
            <div className="space-y-1.5">
              <Label htmlFor={`edit-aanleiding-${alleIds}`}>Aanleiding</Label>
              <Select name="aanleiding" defaultValue={aanleiding}>
                <SelectTrigger
                  id={`edit-aanleiding-${alleIds}`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AANLEIDING_OPTIES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {huurders.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor={`edit-huurder-${alleIds}`}>
                Huurder (bij huurderwissel)
              </Label>
              <Select
                name="huurder_id"
                defaultValue={huurderId ?? undefined}
              >
                <SelectTrigger id={`edit-huurder-${alleIds}`} className="w-full">
                  <SelectValue placeholder="(geen)" />
                </SelectTrigger>
                <SelectContent>
                  {huurders.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {[h.voornaam, h.naam].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {(["koud_water", "warm_water", "cv"] as const).map((t) =>
              idVan(t) ? (
                <Field
                  key={t}
                  label={`${TYPE_LABEL[t]} (m³)`}
                  name={`waarde_${t}`}
                  inputMode="decimal"
                  defaultValue={String(waardeVan(t) ?? "")}
                />
              ) : null,
            )}
          </div>
          <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <ActionForm
          action={verwijderMeterstand}
          hiddenFields={{ ids: alleIds }}
          onSuccess={() => setOpen(false)}
          className="border-t pt-3"
        >
          <ConfirmSubmit
            size="sm"
            variant="ghost"
            message="Deze opname (alle tellers) verwijderen?"
          >
            Opname verwijderen
          </ConfirmSubmit>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
