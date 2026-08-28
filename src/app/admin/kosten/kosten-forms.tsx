"use client";

import type { Boekjaar, Verdeelsleutel } from "@/lib/types";
import { datum as fmtDatum } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createKost, confirmKost, deleteKost } from "./actions";

const CATEGORIEEN = [
  "verzekering",
  "elektriciteit",
  "koud water",
  "warm water",
  "mazout",
  "kuis",
  "onderhoud lift",
  "syndicus",
  "herstellingen",
  "reservefonds",
  "andere",
];

export function CreateKostForm({
  vmeId,
  boekjaren,
  verdeelsleutels,
}: {
  vmeId: string;
  boekjaren: Boekjaar[];
  verdeelsleutels: Verdeelsleutel[];
}) {
  const openEerst = [...boekjaren].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "open" ? -1 : 1,
  );

  return (
    <ActionForm
      action={createKost}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="boekjaar_id">Boekjaar</Label>
        <Select name="boekjaar_id" required>
          <SelectTrigger id="boekjaar_id" className="w-full">
            <SelectValue placeholder="Kies boekjaar" />
          </SelectTrigger>
          <SelectContent>
            {openEerst.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {fmtDatum(b.start_datum)} – {fmtDatum(b.eind_datum)}
                {b.status === "afgesloten" ? " (afgesloten)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categorie">Categorie</Label>
        <Select name="categorie" required>
          <SelectTrigger id="categorie" className="w-full">
            <SelectValue placeholder="Kies categorie" />
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

      <Field label="Bedrag (EUR)" name="bedrag" inputMode="decimal" required />
      <Field label="Datum" name="datum" type="date" required />
      <Field label="Leverancier" name="leverancier" />

      <div className="space-y-1.5">
        <Label htmlFor="verdeelsleutel_id">Verdeelsleutel</Label>
        <Select name="verdeelsleutel_id">
          <SelectTrigger id="verdeelsleutel_id" className="w-full">
            <SelectValue placeholder="(nog niet toewijzen)" />
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
        <Label htmlFor="betaler_type">Ten laste van</Label>
        <Select name="betaler_type" defaultValue="eigenaar">
          <SelectTrigger id="betaler_type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eigenaar">Eigenaar</SelectItem>
            <SelectItem value="huurder">Huurder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="omschrijving">Omschrijving</Label>
        <Textarea id="omschrijving" name="omschrijving" rows={2} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="document">Bewijsstuk (PDF/afbeelding, optioneel)</Label>
        <Input
          id="document"
          name="document"
          type="file"
          accept=".pdf,image/*"
        />
      </div>

      <div className="sm:col-span-2">
        <SubmitButton>Kost boeken</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ConfirmKostButton({ id }: { id: string }) {
  return (
    <ActionForm action={confirmKost} hiddenFields={{ id }}>
      <SubmitButton variant="outline" size="sm">
        Bevestigen
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteKostButton({ id }: { id: string }) {
  return (
    <ActionForm action={deleteKost} hiddenFields={{ id }}>
      <ConfirmSubmit message="Kost verwijderen?" />
    </ActionForm>
  );
}
