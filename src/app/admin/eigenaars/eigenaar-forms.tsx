"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Eigenaar, Unit } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  createEigenaar,
  updateEigenaar,
  deleteEigenaar,
  resendInvite,
} from "./actions";

export function CreateEigenaarForm({ units }: { units: Unit[] }) {
  return (
    <ActionForm
      action={createEigenaar}
      resetOnSuccess
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="unit_id">Unit</Label>
        <Select name="unit_id" required>
          <SelectTrigger id="unit_id" className="w-full">
            <SelectValue placeholder="Kies unit" />
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
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <SubmitButton>Eigenaar toevoegen</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditEigenaarDialog({ eigenaar }: { eigenaar: Eigenaar }) {
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
          <DialogTitle>Eigenaar bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateEigenaar}
          hiddenFields={{ id: eigenaar.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
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
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-3">
          <ActionForm action={resendInvite} hiddenFields={{ email: eigenaar.email ?? "" }}>
            <SubmitButton variant="outline" size="sm">
              Aanmeldlink opnieuw sturen
            </SubmitButton>
          </ActionForm>
          <ActionForm
            action={deleteEigenaar}
            hiddenFields={{ id: eigenaar.id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit message={`Koppeling met ${eigenaar.naam} verwijderen?`}>
              Ontkoppelen
            </ConfirmSubmit>
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
