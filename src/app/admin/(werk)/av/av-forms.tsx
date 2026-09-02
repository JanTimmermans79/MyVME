"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type {
  Aanwezigheid,
  AvAgendapunt,
  AvMeerderheid,
  AvStatus,
  AvType,
  AvVergadering,
  Boekjaar,
} from "@/lib/types";
import {
  AANWEZIGHEID_LABEL,
  AV_MEERDERHEID_LABEL,
  AV_TYPE_LABEL,
} from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import {
  BoekjaarSelect,
  DocumentSelect,
  type DocKeuze,
} from "@/components/keuze-selects";
import {
  createAv,
  updateAv,
  deleteAv,
  setAvStatus,
  setAanwezigheid,
  createAgendapunt,
  updateAgendapunt,
  deleteAgendapunt,
  agendapuntNaarActiepunt,
} from "./actions";

const TYPE_OPTIES = Object.entries(AV_TYPE_LABEL) as [AvType, string][];
const MEERDERHEID_OPTIES = Object.entries(
  AV_MEERDERHEID_LABEL,
) as [AvMeerderheid, string][];

function TypeSelect({ defaultValue = "gewoon" }: { defaultValue?: AvType }) {
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

export function CreateAvForm({
  vmeId,
  boekjaren,
  boekjaarId,
}: {
  vmeId: string;
  boekjaren: Boekjaar[];
  boekjaarId?: string;
}) {
  return (
    <ActionForm
      action={createAv}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum" name="datum" type="date" required />
        <TypeSelect />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Locatie (optioneel)" name="locatie" />
        <BoekjaarSelect boekjaren={boekjaren} defaultValue={boekjaarId} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="omschrijving">Omschrijving (optioneel)</Label>
        <Textarea id="omschrijving" name="omschrijving" rows={2} />
      </div>
      <SubmitButton>AV toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function EditAvDialog({
  av,
  boekjaren,
  documenten,
}: {
  av: AvVergadering;
  boekjaren: Boekjaar[];
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AV bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateAv}
          hiddenFields={{ id: av.id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Datum"
              name="datum"
              type="date"
              required
              defaultValue={av.datum}
            />
            <TypeSelect defaultValue={av.type} />
          </div>
          <Field
            label="Locatie"
            name="locatie"
            defaultValue={av.locatie ?? ""}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <BoekjaarSelect
              boekjaren={boekjaren}
              defaultValue={av.boekjaar_id ?? undefined}
            />
            <DocumentSelect
              documenten={documenten}
              defaultValue={av.notulen_document_id ?? undefined}
              label="Notulen (document)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`av-oms-${av.id}`}>Omschrijving</Label>
            <Textarea
              id={`av-oms-${av.id}`}
              name="omschrijving"
              rows={3}
              defaultValue={av.omschrijving ?? ""}
            />
          </div>
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 border-t pt-3">
          <ActionForm
            action={deleteAv}
            hiddenFields={{ id: av.id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit message="Deze AV met alle agendapunten en aanwezigheden verwijderen?" />
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_KNOP: Record<AvStatus, { volgende: AvStatus; label: string }> = {
  gepland: { volgende: "gehouden", label: "Markeer als gehouden" },
  gehouden: { volgende: "gepland", label: "Terug naar gepland" },
  geannuleerd: { volgende: "gepland", label: "Heropenen" },
};

export function SetAvStatusKnop({ id, status }: { id: string; status: AvStatus }) {
  const k = STATUS_KNOP[status];
  return (
    <div className="flex gap-2">
      <ActionForm
        action={setAvStatus}
        hiddenFields={{ id, status: k.volgende }}
      >
        <SubmitButton size="sm" variant="outline">
          {k.label}
        </SubmitButton>
      </ActionForm>
      {status !== "geannuleerd" && (
        <ActionForm
          action={setAvStatus}
          hiddenFields={{ id, status: "geannuleerd" }}
        >
          <SubmitButton size="sm" variant="ghost">
            Annuleren
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function AanwezigheidRij({
  avId,
  vmeId,
  unitId,
  unitNaam,
  eigenaar,
  quotiteit,
  huidige,
  volmachtNaam,
}: {
  avId: string;
  vmeId: string;
  unitId: string;
  unitNaam: string;
  eigenaar: string | null;
  quotiteit: number | null;
  huidige: Aanwezigheid;
  volmachtNaam: string | null;
}) {
  const [status, setStatus] = useState<Aanwezigheid>(huidige);
  return (
    <ActionForm
      action={setAanwezigheid}
      hiddenFields={{ av_id: avId, vme_id: vmeId, unit_id: unitId }}
      className="flex flex-wrap items-center gap-2 border-b py-2 text-sm last:border-0"
    >
      <span className="w-40 font-medium">{unitNaam}</span>
      <span className="w-40 text-muted-foreground">{eigenaar ?? "—"}</span>
      <span className="w-16 text-right tabular-nums text-muted-foreground">
        {quotiteit ?? "—"}
      </span>
      <input type="hidden" name="aanwezigheid" value={status} />
      <Select
        value={status}
        onValueChange={(v) => setStatus(v as Aanwezigheid)}
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["aanwezig", "volmacht", "afwezig"] as Aanwezigheid[]).map((a) => (
            <SelectItem key={a} value={a}>
              {AANWEZIGHEID_LABEL[a]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {status === "volmacht" && (
        <Input
          name="volmacht_naam"
          placeholder="volmacht aan…"
          defaultValue={volmachtNaam ?? ""}
          className="h-8 w-44"
        />
      )}
      <SubmitButton size="sm" variant="ghost">
        Opslaan
      </SubmitButton>
    </ActionForm>
  );
}

function MeerderheidSelect({
  defaultValue = "volstrekt",
}: {
  defaultValue?: AvMeerderheid;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Vereiste meerderheid</Label>
      <Select name="meerderheid" defaultValue={defaultValue}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MEERDERHEID_OPTIES.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StemVelden({ punt }: { punt?: AvAgendapunt }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field
        label="Stemmen voor"
        name="stemmen_voor"
        inputMode="decimal"
        defaultValue={punt?.stemmen_voor ?? ""}
      />
      <Field
        label="Stemmen tegen"
        name="stemmen_tegen"
        inputMode="decimal"
        defaultValue={punt?.stemmen_tegen ?? ""}
      />
      <Field
        label="Onthoudingen"
        name="stemmen_onthouding"
        inputMode="decimal"
        defaultValue={punt?.stemmen_onthouding ?? ""}
      />
    </div>
  );
}

export function CreateAgendapuntForm({
  avId,
  vmeId,
}: {
  avId: string;
  vmeId: string;
}) {
  return (
    <ActionForm
      action={createAgendapunt}
      resetOnSuccess
      hiddenFields={{ av_id: avId, vme_id: vmeId }}
      className="space-y-3"
    >
      <Field label="Titel" name="titel" required placeholder="Agendapunt" />
      <div className="space-y-1.5">
        <Label htmlFor="toelichting">Toelichting (optioneel)</Label>
        <Textarea id="toelichting" name="toelichting" rows={2} />
      </div>
      <MeerderheidSelect />
      <SubmitButton>Agendapunt toevoegen</SubmitButton>
    </ActionForm>
  );
}

export function EditAgendapuntDialog({ punt }: { punt: AvAgendapunt }) {
  const [open, setOpen] = useState(false);
  const aangenomenDefault =
    punt.aangenomen == null ? "" : punt.aangenomen ? "ja" : "nee";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendapunt bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={updateAgendapunt}
          hiddenFields={{ id: punt.id, av_id: punt.av_id }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
            <Field label="Titel" name="titel" required defaultValue={punt.titel} />
            <Field
              label="Volgnr"
              name="volgnr"
              inputMode="numeric"
              defaultValue={String(punt.volgnr)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ap-toe-${punt.id}`}>Toelichting</Label>
            <Textarea
              id={`ap-toe-${punt.id}`}
              name="toelichting"
              rows={2}
              defaultValue={punt.toelichting ?? ""}
            />
          </div>
          <MeerderheidSelect defaultValue={punt.meerderheid} />
          <StemVelden punt={punt} />
          <div className="space-y-1.5">
            <Label>Uitkomst</Label>
            <Select name="aangenomen" defaultValue={aangenomenDefault}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(volgt uit de stemmen)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">Aangenomen</SelectItem>
                <SelectItem value="nee">Niet aangenomen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ap-bes-${punt.id}`}>Beslissing / notulentekst</Label>
            <Textarea
              id={`ap-bes-${punt.id}`}
              name="beslissing"
              rows={3}
              defaultValue={punt.beslissing ?? ""}
            />
          </div>
          <DialogFooter>
            <SubmitButton>Opslaan</SubmitButton>
          </DialogFooter>
        </ActionForm>
        <div className="mt-2 border-t pt-3">
          <ActionForm
            action={deleteAgendapunt}
            hiddenFields={{ id: punt.id, av_id: punt.av_id }}
            onSuccess={() => setOpen(false)}
          >
            <ConfirmSubmit
              size="sm"
              variant="ghost"
              message="Agendapunt verwijderen?"
            >
              Agendapunt verwijderen
            </ConfirmSubmit>
          </ActionForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AgendapuntActiepuntKnop({
  punt,
}: {
  punt: AvAgendapunt;
}) {
  if (punt.actiepunt_id)
    return (
      <span className="text-xs text-muted-foreground">✓ actiepunt gemaakt</span>
    );
  return (
    <ActionForm
      action={agendapuntNaarActiepunt}
      hiddenFields={{ id: punt.id }}
    >
      <SubmitButton size="sm" variant="ghost">
        <Plus className="size-3.5" /> Actiepunt maken
      </SubmitButton>
    </ActionForm>
  );
}
