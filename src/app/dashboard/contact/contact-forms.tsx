"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Eigenaar, Huurder, Unit } from "@/lib/types";
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
import { updateEigenContact, upsertHuurder, deleteHuurder } from "../actions";

export function EigenContactForm({ eigenaar }: { eigenaar: Eigenaar }) {
  return (
    <ActionForm
      action={updateEigenContact}
      hiddenFields={{ id: eigenaar.id }}
      className="grid gap-3 sm:grid-cols-3"
    >
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
      <div className="sm:col-span-3">
        <SubmitButton>Opslaan</SubmitButton>
      </div>
    </ActionForm>
  );
}

function HuurderFields({ huurder }: { huurder?: Huurder }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Naam" name="naam" required defaultValue={huurder?.naam ?? ""} />
      <Field
        label="E-mail"
        name="email"
        type="email"
        defaultValue={huurder?.email ?? ""}
      />
      <Field
        label="Telefoon"
        name="telefoon"
        defaultValue={huurder?.telefoon ?? ""}
      />
      <div />
      <Field
        label="Ingangsdatum"
        name="ingang_datum"
        type="date"
        defaultValue={huurder?.ingang_datum ?? ""}
      />
      <Field
        label="Uitgangsdatum"
        name="uitgang_datum"
        type="date"
        defaultValue={huurder?.uitgang_datum ?? ""}
      />
    </div>
  );
}

export function AddHuurderDialog({ unit }: { unit: Unit }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" /> Huurder toevoegen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Huurder toevoegen — {unit.naam}</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={upsertHuurder}
          hiddenFields={{ unit_id: unit.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <HuurderFields />
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
        <Button size="sm" variant="outline">
          <Pencil className="size-3.5" /> Bewerken
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Huurder bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={upsertHuurder}
          hiddenFields={{ id: huurder.id, unit_id: huurder.unit_id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <HuurderFields huurder={huurder} />
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
            <ConfirmSubmit message={`Huurder "${huurder.naam}" verwijderen?`} />
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
