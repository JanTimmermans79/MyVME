"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Unit } from "@/lib/types";
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
import { createUnit, renameUnit, deleteUnit } from "./actions";

export function CreateUnitForm({ vmeId }: { vmeId: string }) {
  return (
    <ActionForm
      action={createUnit}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="flex flex-wrap items-end gap-3"
    >
      <Field
        label="Naam"
        name="naam"
        required
        placeholder="Appartement 2A"
        className="min-w-[16rem]"
      />
      <Field
        label="Quotiteit"
        name="quotiteit"
        inputMode="decimal"
        placeholder="bv. 250"
        hint="Aandeel in de gemene delen (/1000). Optioneel."
        className="min-w-[10rem]"
      />
      <SubmitButton>Unit toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function EditUnitDialog({ unit }: { unit: Unit }) {
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
          <DialogTitle>Unit bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={renameUnit}
          hiddenFields={{ id: unit.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <Field label="Naam" name="naam" required defaultValue={unit.naam} />
          <Field
            label="Quotiteit"
            name="quotiteit"
            inputMode="decimal"
            defaultValue={unit.quotiteit ?? ""}
            hint="Aandeel in de gemene delen (/1000). Leeg = telt voor 1 op de AV."
          />
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 border-t pt-3">
          <ActionForm
            action={deleteUnit}
            hiddenFields={{ id: unit.id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit message={`Unit "${unit.naam}" verwijderen?`} />
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
