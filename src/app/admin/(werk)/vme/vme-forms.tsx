"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Vme } from "@/lib/types";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>VME bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateVme}
          hiddenFields={{ id: vme.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
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
          <Field label="Adres" name="adres" defaultValue={vme.adres ?? ""} />
          <DialogFooter>
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
