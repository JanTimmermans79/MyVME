"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Boekjaar, Kosten, Verdeelsleutel } from "@/lib/types";
import { datum as fmtDatum } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { KostToewijzing } from "@/components/kost-toewijzing";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { createKost, updateKost, confirmKost, deleteKost } from "./actions";

export function CreateKostForm({
  vmeId,
  boekjaren,
  verdeelsleutels,
  categorieen,
  rekening,
}: {
  vmeId: string;
  boekjaren: Boekjaar[];
  verdeelsleutels: Verdeelsleutel[];
  categorieen: string[];
  rekening?: "zicht" | "spaar";
}) {
  const openEerst = [...boekjaren].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "open" ? -1 : 1,
  );

  return (
    <ActionForm
      action={createKost}
      resetOnSuccess
      hiddenFields={
        rekening ? { vme_id: vmeId, rekening } : { vme_id: vmeId }
      }
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

      <KostToewijzing idPrefix="nieuw" categorieen={categorieen} />

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

export function EditKostDialog({
  kost,
  boekjaren,
  verdeelsleutels,
  categorieen = [],
}: {
  kost: Kosten;
  boekjaren: Boekjaar[];
  verdeelsleutels: Verdeelsleutel[];
  categorieen?: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="size-3.5" /> Bewerken
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kost bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateKost}
          hiddenFields={{ id: kost.id, vme_id: kost.vme_id }}
          onSuccess={() => setOpen(false)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`bj-${kost.id}`}>Boekjaar</Label>
            <Select name="boekjaar_id" defaultValue={kost.boekjaar_id} required>
              <SelectTrigger id={`bj-${kost.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boekjaren.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {fmtDatum(b.start_datum)} – {fmtDatum(b.eind_datum)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <KostToewijzing
            idPrefix={`kt-${kost.id}`}
            categorieen={categorieen}
            defaultVerdeling={kost.verdeling}
            defaultCategorie={kost.categorie}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`rek-${kost.id}`}>Rekening</Label>
            <Select name="rekening" defaultValue={kost.rekening ?? "zicht"}>
              <SelectTrigger id={`rek-${kost.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zicht">Zichtrekening</SelectItem>
                <SelectItem value="spaar">Spaarrekening</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field
            label="Bedrag (EUR)"
            name="bedrag"
            inputMode="decimal"
            defaultValue={String(kost.bedrag)}
            required
          />
          <Field
            label="Datum"
            name="datum"
            type="date"
            defaultValue={kost.datum}
            required
          />
          <Field
            label="Leverancier"
            name="leverancier"
            defaultValue={kost.leverancier ?? ""}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`vs-${kost.id}`}>Verdeelsleutel</Label>
            <Select
              name="verdeelsleutel_id"
              defaultValue={kost.verdeelsleutel_id ?? undefined}
            >
              <SelectTrigger id={`vs-${kost.id}`} className="w-full">
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`om-${kost.id}`}>Omschrijving</Label>
            <Textarea
              id={`om-${kost.id}`}
              name="omschrijving"
              rows={2}
              defaultValue={kost.omschrijving ?? ""}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`doc-${kost.id}`}>
              Bewijsstuk vervangen (optioneel)
            </Label>
            <Input
              id={`doc-${kost.id}`}
              name="document"
              type="file"
              accept=".pdf,image/*"
            />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Opslaan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
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
