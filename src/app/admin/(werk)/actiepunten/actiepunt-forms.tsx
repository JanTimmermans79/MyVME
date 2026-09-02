"use client";

import { useState } from "react";
import { Pencil, FileText } from "lucide-react";
import type { Actiepunt, ActiepuntStatus, Boekjaar } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BoekjaarSelect,
  DocumentSelect,
  type DocKeuze,
} from "@/components/keuze-selects";
import {
  createActiepunt,
  updateActiepunt,
  importActiepunten,
  setActiepuntStatus,
} from "./actions";

export type { DocKeuze };

export function CreateActiepuntForm({
  vmeId,
  boekjaren,
  documenten,
  boekjaarId,
}: {
  vmeId: string;
  boekjaren: Boekjaar[];
  documenten: DocKeuze[];
  boekjaarId?: string;
}) {
  return (
    <ActionForm
      action={createActiepunt}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="space-y-3"
    >
      <Field label="Titel" name="titel" required placeholder="Wat moet er gebeuren?" />
      <div className="space-y-1.5">
        <Label htmlFor="omschrijving">Toelichting (optioneel)</Label>
        <Textarea id="omschrijving" name="omschrijving" rows={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deadline (optioneel)" name="deadline" type="date" />
        <Field
          label="Verantwoordelijke (optioneel)"
          name="verantwoordelijke"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <BoekjaarSelect boekjaren={boekjaren} defaultValue={boekjaarId} />
        <DocumentSelect documenten={documenten} />
      </div>
      <SubmitButton>Actiepunt toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function ImportActiepuntenDialog({
  vmeId,
  boekjaren,
  documenten,
  boekjaarId,
}: {
  vmeId: string;
  boekjaren: Boekjaar[];
  documenten: DocKeuze[];
  boekjaarId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="size-3.5" /> Uit jaarverslag overnemen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Actiepunten uit een jaarverslag overnemen</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={importActiepunten}
          hiddenFields={{ vme_id: vmeId }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="tekst">
              Plak het stuk uit de notulen / het jaarverslag — één actiepunt per
              regel. Opsommingstekens en nummering worden weggehaald.
            </Label>
            <Textarea
              id="tekst"
              name="tekst"
              rows={10}
              required
              placeholder={
                "- Offertes opvragen voor het schilderen van de trappenhal\n- Brandblussers laten keuren voor 30/06\n- Nieuwe syndicusovereenkomst voorleggen op de volgende AV"
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BoekjaarSelect boekjaren={boekjaren} defaultValue={boekjaarId} />
            <DocumentSelect documenten={documenten} />
          </div>
          <DialogFooter>
            <SubmitButton>Overnemen</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function EditActiepuntDialog({
  actiepunt,
  boekjaren,
  documenten,
}: {
  actiepunt: Actiepunt;
  boekjaren: Boekjaar[];
  documenten: DocKeuze[];
}) {
  const [open, setOpen] = useState(false);
  const a = actiepunt;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Actiepunt bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateActiepunt}
          hiddenFields={{ id: a.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <Field label="Titel" name="titel" required defaultValue={a.titel} />
          <div className="space-y-1.5">
            <Label htmlFor={`oms-${a.id}`}>Toelichting</Label>
            <Textarea
              id={`oms-${a.id}`}
              name="omschrijving"
              rows={3}
              defaultValue={a.omschrijving ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Deadline"
              name="deadline"
              type="date"
              defaultValue={a.deadline ?? ""}
            />
            <Field
              label="Verantwoordelijke"
              name="verantwoordelijke"
              defaultValue={a.verantwoordelijke ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BoekjaarSelect
              boekjaren={boekjaren}
              defaultValue={a.boekjaar_id ?? undefined}
            />
            <DocumentSelect
              documenten={documenten}
              defaultValue={a.document_id ?? undefined}
            />
          </div>
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

const VOLGENDE: Record<ActiepuntStatus, ActiepuntStatus> = {
  open: "bezig",
  bezig: "afgewerkt",
  afgewerkt: "open",
};
const KNOP_LABEL: Record<ActiepuntStatus, string> = {
  open: "Start",
  bezig: "Afwerken",
  afgewerkt: "Heropenen",
};

export function ActiepuntStatusKnop({
  id,
  status,
}: {
  id: string;
  status: ActiepuntStatus;
}) {
  return (
    <ActionForm
      action={setActiepuntStatus}
      hiddenFields={{ id, status: VOLGENDE[status] }}
    >
      <SubmitButton
        size="sm"
        variant={status === "afgewerkt" ? "ghost" : "outline"}
      >
        {KNOP_LABEL[status]}
      </SubmitButton>
    </ActionForm>
  );
}
