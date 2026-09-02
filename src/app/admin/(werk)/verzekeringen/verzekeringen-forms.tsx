"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type {
  PolisType,
  SchadeStatus,
  Unit,
  VerzekeringPolis,
  VerzekeringSchade,
} from "@/lib/types";
import { POLIS_TYPE_LABEL, SCHADE_STATUS_LABEL } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentSelect, type DocKeuze } from "@/components/keuze-selects";
import {
  createPolis,
  updatePolis,
  deletePolis,
  setPolisActief,
  createSchade,
  updateSchade,
  deleteSchade,
} from "./actions";

const TYPE_OPTIES = Object.entries(POLIS_TYPE_LABEL) as [PolisType, string][];
const STATUS_OPTIES = Object.entries(
  SCHADE_STATUS_LABEL,
) as [SchadeStatus, string][];

function TypeSelect({ defaultValue = "brand" }: { defaultValue?: PolisType }) {
  return (
    <div className="space-y-1.5">
      <Label>Type</Label>
      <Select name="type" defaultValue={defaultValue}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIES.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PolisVelden({ polis }: { polis?: VerzekeringPolis }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Maatschappij"
          name="maatschappij"
          required
          defaultValue={polis?.maatschappij ?? ""}
        />
        <Field
          label="Polisnummer"
          name="polisnummer"
          defaultValue={polis?.polisnummer ?? ""}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TypeSelect defaultValue={polis?.type} />
        <Field
          label="Jaarpremie (EUR)"
          name="jaarpremie"
          inputMode="decimal"
          defaultValue={polis?.jaarpremie ?? ""}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Ingangsdatum"
          name="ingang_datum"
          type="date"
          defaultValue={polis?.ingang_datum ?? ""}
        />
        <Field
          label="Vervaldatum"
          name="vervaldatum"
          type="date"
          defaultValue={polis?.vervaldatum ?? ""}
        />
        <Field
          label="Hoofdvervaldag"
          name="hoofdvervaldag"
          placeholder="bv. 1 januari"
          defaultValue={polis?.hoofdvervaldag ?? ""}
        />
      </div>
      <Field
        label="Makelaar (optioneel)"
        name="makelaar"
        defaultValue={polis?.makelaar ?? ""}
      />
    </>
  );
}

export function CreatePolisForm({
  vmeId,
  documenten,
}: {
  vmeId: string;
  documenten: DocKeuze[];
}) {
  return (
    <ActionForm
      action={createPolis}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="space-y-3"
    >
      <PolisVelden />
      <DocumentSelect documenten={documenten} label="Polis (document)" />
      <div className="space-y-1.5">
        <Label htmlFor="opmerkingen">Opmerkingen (optioneel)</Label>
        <Textarea id="opmerkingen" name="opmerkingen" rows={2} />
      </div>
      <SubmitButton>Polis toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function EditPolisDialog({
  polis,
  documenten,
}: {
  polis: VerzekeringPolis;
  documenten: DocKeuze[];
}) {
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
          <DialogTitle>Polis bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updatePolis}
          hiddenFields={{ id: polis.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <PolisVelden polis={polis} />
          <DocumentSelect
            documenten={documenten}
            label="Polis (document)"
            defaultValue={polis.document_id ?? undefined}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`p-opm-${polis.id}`}>Opmerkingen</Label>
            <Textarea
              id={`p-opm-${polis.id}`}
              name="opmerkingen"
              rows={2}
              defaultValue={polis.opmerkingen ?? ""}
            />
          </div>
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 flex items-center justify-between border-t pt-3">
          <ActionForm
            action={setPolisActief}
            hiddenFields={{ id: polis.id, actief: polis.actief ? "nee" : "ja" }}
          >
            <SubmitButton size="sm" variant="outline">
              {polis.actief ? "Op inactief zetten" : "Heractiveren"}
            </SubmitButton>
          </ActionForm>
          <ActionForm
            action={deletePolis}
            hiddenFields={{ id: polis.id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit message="Polis en alle schadedossiers verwijderen?" />
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Schade -------------------------------------------------------------

function StatusSelect({
  defaultValue = "gemeld",
}: {
  defaultValue?: SchadeStatus;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Status</Label>
      <Select name="status" defaultValue={defaultValue}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIES.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UnitSelect({
  units,
  defaultValue,
}: {
  units: Unit[];
  defaultValue?: string;
}) {
  if (units.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <Label>Appartement (optioneel)</Label>
      <Select name="unit_id" defaultValue={defaultValue}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="(gemene delen)" />
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
  );
}

function SchadeVelden({
  schade,
  units,
  documenten,
}: {
  schade?: VerzekeringSchade;
  units: Unit[];
  documenten: DocKeuze[];
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Datum"
          name="datum"
          type="date"
          required
          defaultValue={schade?.datum ?? ""}
        />
        <StatusSelect defaultValue={schade?.status} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`s-oms-${schade?.id ?? "new"}`}>Omschrijving</Label>
        <Textarea
          id={`s-oms-${schade?.id ?? "new"}`}
          name="omschrijving"
          rows={2}
          required
          defaultValue={schade?.omschrijving ?? ""}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Dossiernummer"
          name="dossiernummer"
          defaultValue={schade?.dossiernummer ?? ""}
        />
        <Field
          label="Schadebedrag (EUR)"
          name="schadebedrag"
          inputMode="decimal"
          defaultValue={schade?.schadebedrag ?? ""}
        />
        <Field
          label="Uitgekeerd (EUR)"
          name="uitgekeerd_bedrag"
          inputMode="decimal"
          defaultValue={schade?.uitgekeerd_bedrag ?? ""}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <UnitSelect units={units} defaultValue={schade?.unit_id ?? undefined} />
        <DocumentSelect
          documenten={documenten}
          label="Document (optioneel)"
          defaultValue={schade?.document_id ?? undefined}
        />
      </div>
    </>
  );
}

export function CreateSchadeForm({
  vmeId,
  polisId,
  units,
  documenten,
}: {
  vmeId: string;
  polisId: string;
  units: Unit[];
  documenten: DocKeuze[];
}) {
  return (
    <ActionForm
      action={createSchade}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId, polis_id: polisId }}
      className="space-y-3"
    >
      <SchadeVelden units={units} documenten={documenten} />
      <SubmitButton>Schadedossier toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function EditSchadeDialog({
  schade,
  units,
  documenten,
}: {
  schade: VerzekeringSchade;
  units: Unit[];
  documenten: DocKeuze[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schadedossier bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateSchade}
          hiddenFields={{ id: schade.id, polis_id: schade.polis_id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <SchadeVelden schade={schade} units={units} documenten={documenten} />
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 border-t pt-3">
          <ActionForm
            action={deleteSchade}
            hiddenFields={{ id: schade.id, polis_id: schade.polis_id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit
              size="sm"
              variant="ghost"
              message="Schadedossier verwijderen?"
            >
              Verwijderen
            </ConfirmSubmit>
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
