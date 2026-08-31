"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Bankrelatie, Verdeelsleutel } from "@/lib/types";
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
  createBankrelatie,
  updateBankrelatie,
  deleteBankrelatie,
} from "./actions";

const CATEGORIEEN = [
  "elektriciteit",
  "koud water",
  "warm water",
  "mazout",
  "schoonmaak",
  "water onderhoud",
  "verzekering",
  "onderhoud lift",
  "syndicus",
  "diverse",
];

function Fields({
  br,
  verdeelsleutels,
}: {
  br?: Bankrelatie;
  verdeelsleutels: Verdeelsleutel[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Naam" name="naam" required defaultValue={br?.naam ?? ""} />
      <Field
        label="IBAN"
        name="iban"
        placeholder="BE.."
        defaultValue={br?.iban ?? ""}
      />
      <Field
        label="Mandaatreferte (domiciliëring)"
        name="mandaatreferte"
        hint="Voor domiciliëringen zonder IBAN, bv. Eneco 61000001597504"
        defaultValue={br?.mandaatreferte ?? ""}
      />
      <Field
        label="Herken aan naam (deel)"
        name="naam_bevat"
        hint='bv. "KBC-Bedrijfsrekening" voor bankkosten zonder IBAN'
        defaultValue={br?.naam_bevat ?? ""}
      />
      <div className="space-y-1.5">
        <Label htmlFor="type">Type</Label>
        <Select name="type" defaultValue={br?.type ?? "leverancier"}>
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leverancier">Leverancier</SelectItem>
            <SelectItem value="eigen_rekening">Eigen rekening VME</SelectItem>
            <SelectItem value="overig">Overig</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="standaard_categorie">Standaard categorie</Label>
        <Select
          name="standaard_categorie"
          defaultValue={br?.standaard_categorie ?? undefined}
        >
          <SelectTrigger id="standaard_categorie" className="w-full">
            <SelectValue placeholder="(geen)" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIEEN.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="standaard_verdeelsleutel_id">Standaard verdeelsleutel</Label>
        <Select
          name="standaard_verdeelsleutel_id"
          defaultValue={br?.standaard_verdeelsleutel_id ?? undefined}
        >
          <SelectTrigger id="standaard_verdeelsleutel_id" className="w-full">
            <SelectValue placeholder="(geen)" />
          </SelectTrigger>
          <SelectContent>
            {verdeelsleutels.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.naam}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="standaard_verdeling">Standaard verdeling</Label>
        <Select
          name="standaard_verdeling"
          defaultValue={br?.standaard_verdeling ?? undefined}
        >
          <SelectTrigger id="standaard_verdeling" className="w-full">
            <SelectValue placeholder="(geen)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gelijk_huurders">
              Gelijk over de huurders
            </SelectItem>
            <SelectItem value="individueel_verbruik">
              Individueel verbruik (tellers)
            </SelectItem>
            <SelectItem value="per_quotiteit">Per quotiteit</SelectItem>
            <SelectItem value="gelijk_eigenaars">
              Gelijk over de eigenaars
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function CreateBankrelatieForm({
  vmeId,
  verdeelsleutels,
}: {
  vmeId: string;
  verdeelsleutels: Verdeelsleutel[];
}) {
  return (
    <ActionForm
      action={createBankrelatie}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="space-y-3"
    >
      <Fields verdeelsleutels={verdeelsleutels} />
      <SubmitButton>Leverancier toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function EditBankrelatieDialog({
  br,
  verdeelsleutels,
}: {
  br: Bankrelatie;
  verdeelsleutels: Verdeelsleutel[];
}) {
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
          <DialogTitle>Leverancier bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateBankrelatie}
          hiddenFields={{ id: br.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <Fields br={br} verdeelsleutels={verdeelsleutels} />
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 border-t pt-3">
          <ActionForm
            action={deleteBankrelatie}
            hiddenFields={{ id: br.id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit message={`"${br.naam}" verwijderen?`} />
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
