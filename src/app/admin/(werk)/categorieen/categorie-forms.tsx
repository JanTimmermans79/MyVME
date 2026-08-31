"use client";

import type { Categorie } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Label } from "@/components/ui/label";
import { createCategorie, updateCategorie, deleteCategorie } from "./actions";

const GROEP_LABEL: Record<string, string> = {
  verbruik: "Verbruik (via meterstand)",
  divers: "Divers (pro rata huurders)",
  eigenaar: "Eigenaarskost",
};

function GroepSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? "divers"}
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
    >
      {Object.entries(GROEP_LABEL).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function CreateCategorieForm({ vmeId }: { vmeId: string }) {
  return (
    <ActionForm
      action={createCategorie}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="flex flex-wrap items-end gap-3"
    >
      <Field label="Naam" name="naam" required />
      <div className="space-y-1.5">
        <Label>Groep</Label>
        <GroepSelect name="groep" />
      </div>
      <SubmitButton size="sm">Toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function CategorieRij({ categorie }: { categorie: Categorie }) {
  return (
    <ActionForm
      action={updateCategorie}
      hiddenFields={{ id: categorie.id }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        name="naam"
        defaultValue={categorie.naam}
        className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm"
      />
      <GroepSelect name="groep" defaultValue={categorie.groep} />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" name="actief" defaultChecked={categorie.actief} />{" "}
        actief
      </label>
      <SubmitButton size="sm" variant="ghost">
        Opslaan
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteCategorieButton({ id }: { id: string }) {
  return (
    <ActionForm action={deleteCategorie} hiddenFields={{ id }}>
      <ConfirmSubmit size="sm" variant="ghost" message="Categorie verwijderen?">
        ✕
      </ConfirmSubmit>
    </ActionForm>
  );
}
