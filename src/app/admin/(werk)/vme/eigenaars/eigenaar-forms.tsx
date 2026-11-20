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
import type { Eigenaar, Unit } from "@/lib/types";
import {
  archiveerEigenaar,
  createEigenaar,
  deleteEigenaar,
  heractiveerEigenaar,
  resendInvite,
  updateEigenaar,
} from "./actions";

function UnitSelect({
  units,
  defaultValue,
  idPrefix,
}: {
  units: Unit[];
  defaultValue?: string;
  idPrefix: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-unit`}>Appartement / kavel</Label>
      <Select name="unit_id" defaultValue={defaultValue} required>
        <SelectTrigger id={`${idPrefix}-unit`} className="w-full">
          <SelectValue placeholder="Kies kavel" />
        </SelectTrigger>
        <SelectContent>
          {units.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.naam}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CreateEigenaarForm({
  units,
  defaultUnitId,
}: {
  units: Unit[];
  defaultUnitId?: string;
}) {
  return (
    <ActionForm
      action={createEigenaar}
      resetOnSuccess
      className="grid gap-3 sm:grid-cols-2"
    >
      <UnitSelect units={units} defaultValue={defaultUnitId} idPrefix="nieuw" />
      <Field label="Eigenaar sinds" name="ingang_datum" type="date" />
      <Field label="Voornaam" name="voornaam" />
      <Field label="Naam" name="naam" required />
      <Field label="E-mail" name="email" type="email" required />
      <Field label="Telefoon" name="telefoon" />
      <Field
        label="Rekeningnummer (IBAN)"
        name="iban"
        placeholder="BE.."
        hint="Voor het automatisch matchen van voorschotten uit de bankimport."
      />
      <Field
        label="Structuurcode-prefix (bankmatching)"
        name="structuurcode_prefix"
        hint="Prefix in de gestructureerde mededeling, bv. 100 of +++100"
      />
      <div className="sm:col-span-2">
        <SubmitButton>Eigenaar toevoegen</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Details van een actieve eigenaar, rechtstreeks aanpasbaar. */
export function EigenaarKaart({
  eigenaar,
  units,
}: {
  eigenaar: Eigenaar;
  units: Unit[];
}) {
  const id = eigenaar.id;
  return (
    <div className="rounded-lg border p-4">
      <ActionForm
        action={updateEigenaar}
        hiddenFields={{ id }}
        className="grid gap-3 sm:grid-cols-3"
      >
        <UnitSelect units={units} defaultValue={eigenaar.unit_id} idPrefix={id} />
        <Field
          label="Voornaam"
          name="voornaam"
          defaultValue={eigenaar.voornaam ?? ""}
        />
        <Field label="Naam" name="naam" required defaultValue={eigenaar.naam} />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={eigenaar.email ?? ""}
        />
        <Field
          label="Telefoon"
          name="telefoon"
          defaultValue={eigenaar.telefoon ?? ""}
        />
        <Field
          label="Rekeningnummer (IBAN)"
          name="iban"
          defaultValue={eigenaar.iban ?? ""}
        />
        <Field
          label="Structuurcode-prefix"
          name="structuurcode_prefix"
          defaultValue={eigenaar.structuurcode_prefix ?? ""}
        />
        <div className="flex items-end sm:col-span-2">
          <SubmitButton>Opslaan</SubmitButton>
        </div>
      </ActionForm>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t pt-3">
        <ActionForm
          action={archiveerEigenaar}
          hiddenFields={{ id }}
          className="flex items-end gap-2"
        >
          <Field
            label="Verkocht op / einde eigendom"
            name="eind_datum"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <ConfirmSubmit
            message={`${eigenaar.naam} naar het archief verplaatsen? Voeg daarna de nieuwe eigenaar toe.`}
          >
            Naar archief
          </ConfirmSubmit>
        </ActionForm>
        <ActionForm
          action={resendInvite}
          hiddenFields={{ email: eigenaar.email ?? "" }}
        >
          <SubmitButton variant="outline" size="sm">
            Aanmeldlink opnieuw sturen
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

/** Rij in het archief: enkel raadplegen, eventueel opnieuw activeren of ontkoppelen. */
export function ArchiefEigenaarActies({ eigenaar }: { eigenaar: Eigenaar }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ActionForm action={heractiveerEigenaar} hiddenFields={{ id: eigenaar.id }}>
        <SubmitButton variant="outline" size="sm">
          Opnieuw actief
        </SubmitButton>
      </ActionForm>
      <ActionForm action={deleteEigenaar} hiddenFields={{ id: eigenaar.id }}>
        <ConfirmSubmit
          message={`${eigenaar.naam} definitief uit de database verwijderen?`}
        >
          Verwijderen
        </ConfirmSubmit>
      </ActionForm>
    </div>
  );
}
