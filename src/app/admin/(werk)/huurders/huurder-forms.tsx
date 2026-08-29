"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Huurder, Unit } from "@/lib/types";
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
import { createHuurder, updateHuurder, deleteHuurder } from "./actions";

function Fields({ huurder }: { huurder?: Huurder }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Voornaam" name="voornaam" defaultValue={huurder?.voornaam ?? ""} />
      <Field label="Naam" name="naam" required defaultValue={huurder?.naam ?? ""} />
      <Field
        label="E-mail"
        name="email"
        type="email"
        defaultValue={huurder?.email ?? ""}
      />
      <Field label="Telefoon" name="telefoon" defaultValue={huurder?.telefoon ?? ""} />
      <Field
        label="Rekeningnummer (IBAN)"
        name="iban"
        placeholder="BE.."
        defaultValue={huurder?.iban ?? ""}
        className="sm:col-span-2"
      />
      <Field
        label="Huur gestart op"
        name="ingang_datum"
        type="date"
        defaultValue={huurder?.ingang_datum ?? ""}
      />
      <Field
        label="Huur geëindigd op"
        name="uitgang_datum"
        type="date"
        defaultValue={huurder?.uitgang_datum ?? ""}
      />
    </div>
  );
}

export function AddHuurderDialog({ units }: { units: Unit[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" /> Huurder toevoegen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe huurder</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={createHuurder}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="unit_id">Appartement</Label>
            <Select name="unit_id" required>
              <SelectTrigger id="unit_id" className="w-full">
                <SelectValue placeholder="Kies appartement" />
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
          <Fields />
          <DialogFooter>
            <SubmitButton>Toevoegen</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function EditHuurderDialog({ huurder }: { huurder: Huurder }) {
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
          <DialogTitle>Huurder bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateHuurder}
          hiddenFields={{ id: huurder.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <Fields huurder={huurder} />
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 border-t pt-3">
          <ActionForm
            action={deleteHuurder}
            hiddenFields={{ id: huurder.id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit
              message={`Huurder "${[huurder.voornaam, huurder.naam].filter(Boolean).join(" ")}" verwijderen?`}
            />
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
