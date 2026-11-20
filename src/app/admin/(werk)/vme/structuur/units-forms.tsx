"use client";

import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNIT_TYPES, type Unit } from "@/lib/types";
import { createUnit, renameUnit, deleteUnit } from "./actions";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function TypeSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <div className="space-y-1.5">
      <Label>Soort</Label>
      <Select name="type" defaultValue={defaultValue ?? "appartement"}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNIT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {cap(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CreateUnitForm({ vmeId }: { vmeId: string }) {
  return (
    <ActionForm
      action={createUnit}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="grid gap-3 sm:grid-cols-4 sm:items-end"
    >
      <Field label="Naam" name="naam" required placeholder="Garagebox 3" />
      <TypeSelect />
      <Field
        label="Quotiteit"
        name="quotiteit"
        inputMode="decimal"
        placeholder="bv. 250"
      />
      <SubmitButton>Toevoegen</SubmitButton>
    </ActionForm>
  );
}

/** Eén rij van de structuur: rechtstreeks aanpasbaar en op te slaan. */
export function UnitRij({ unit }: { unit: Unit }) {
  return (
    <div className="rounded-lg border p-3">
      <ActionForm
        action={renameUnit}
        hiddenFields={{ id: unit.id }}
        className="grid gap-3 sm:grid-cols-4 sm:items-end"
      >
        <Field label="Naam" name="naam" required defaultValue={unit.naam} />
        <TypeSelect defaultValue={unit.type} />
        <Field
          label="Quotiteit"
          name="quotiteit"
          inputMode="decimal"
          defaultValue={unit.quotiteit ?? ""}
        />
        <SubmitButton>Opslaan</SubmitButton>
      </ActionForm>
      <div className="mt-2 flex justify-end">
        <ActionForm action={deleteUnit} hiddenFields={{ id: unit.id }}>
          <ConfirmSubmit message={`"${unit.naam}" verwijderen?`} />
        </ActionForm>
      </div>
    </div>
  );
}
