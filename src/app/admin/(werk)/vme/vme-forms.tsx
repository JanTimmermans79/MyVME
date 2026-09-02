"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Vme } from "@/lib/types";
import { VME_GEGEVEN_VELDEN } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createVme, updateVme, deleteVme } from "./actions";

/** Optionele KBO-/juridische gegevens — inklapbaar zodat het formulier rustig blijft. */
function VmeGegevensVelden({ vme }: { vme?: Vme }) {
  return (
    <details className="sm:col-span-2 rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        VME-gegevens (KBO / juridisch) — optioneel
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {VME_GEGEVEN_VELDEN.map((v) => (
          <Field
            key={v.key}
            label={v.label}
            name={v.key}
            type={v.type === "date" ? "date" : undefined}
            defaultValue={(vme?.[v.key] as string | null) ?? ""}
          />
        ))}
      </div>
    </details>
  );
}

export function CreateVmeForm() {
  return (
    <ActionForm
      action={createVme}
      resetOnSuccess
      className="grid gap-3 sm:grid-cols-2"
    >
      <Field label="Naam" name="naam" required />
      <Field
        label="Aantal appartementen"
        name="aantal_kavels"
        type="number"
        min={0}
        inputMode="numeric"
      />
      <Field
        label="Zichtrekening (IBAN)"
        name="iban"
        placeholder="BE.."
        hint="Werkingsrekening: hierop betalen eigenaars en huurders hun voorschotten."
      />
      <Field
        label="Spaarrekening / reservefonds (IBAN)"
        name="iban_reserve"
        placeholder="BE.."
        hint="Reservefonds van de VME."
      />
      <Field label="Adres" name="adres" className="sm:col-span-2" />
      <VmeGegevensVelden />
      <div className="sm:col-span-2">
        <SubmitButton>VME toevoegen</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditVmeDialog({ vme }: { vme: Vme }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Bewerken
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>VME bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateVme}
          hiddenFields={{ id: vme.id }}
          onSuccess={() => setOpen(false)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Field label="Naam" name="naam" required defaultValue={vme.naam} />
          <Field
            label="Aantal appartementen"
            name="aantal_kavels"
            type="number"
            min={0}
            defaultValue={vme.aantal_kavels ?? ""}
          />
          <Field
            label="Zichtrekening (IBAN)"
            name="iban"
            defaultValue={vme.iban ?? ""}
            hint="Voorschotten van eigenaars/huurders."
          />
          <Field
            label="Spaarrekening / reservefonds (IBAN)"
            name="iban_reserve"
            defaultValue={vme.iban_reserve ?? ""}
          />
          <Field
            label="Adres"
            name="adres"
            defaultValue={vme.adres ?? ""}
            className="sm:col-span-2"
          />
          <VmeGegevensVelden vme={vme} />
          <DialogFooter className="sm:col-span-2">
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 border-t pt-3">
          <ActionForm
            action={deleteVme}
            hiddenFields={{ id: vme.id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit message={`VME "${vme.naam}" verwijderen?`} />
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
