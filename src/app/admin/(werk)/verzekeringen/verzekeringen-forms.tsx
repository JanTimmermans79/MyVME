"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
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
import type { PolisExtract } from "@/lib/types";
import {
  createPolis,
  updatePolis,
  deletePolis,
  setPolisActief,
  createSchade,
  updateSchade,
  deleteSchade,
  verwerkPolisDocument,
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

function PolisVelden({
  polis,
  prefill,
}: {
  polis?: VerzekeringPolis;
  prefill?: PolisExtract;
}) {
  const v = <K extends keyof VerzekeringPolis & keyof PolisExtract>(
    k: K,
  ): string => String(polis?.[k] ?? prefill?.[k] ?? "");
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Maatschappij"
          name="maatschappij"
          required
          defaultValue={v("maatschappij")}
        />
        <Field
          label="Polisnummer"
          name="polisnummer"
          defaultValue={v("polisnummer")}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TypeSelect defaultValue={polis?.type ?? prefill?.type} />
        <Field
          label="Jaarpremie (EUR)"
          name="jaarpremie"
          inputMode="decimal"
          defaultValue={v("jaarpremie")}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Ingangsdatum"
          name="ingang_datum"
          type="date"
          defaultValue={v("ingang_datum")}
        />
        <Field
          label="Vervaldatum"
          name="vervaldatum"
          type="date"
          defaultValue={v("vervaldatum")}
          hint="Enkel invullen bij een tijdelijk contract met een echte einddatum."
        />
        <Field
          label="Hoofdvervaldag"
          name="hoofdvervaldag"
          placeholder="bv. 1 januari"
          defaultValue={v("hoofdvervaldag")}
          hint="De jaarlijkse vervaldag van een doorlopend contract."
        />
      </div>
      <Field
        label="Makelaar (optioneel)"
        name="makelaar"
        defaultValue={v("makelaar")}
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

const BRON_TEKST: Record<PolisExtract["bron"], string> = {
  ai: "AI-voorstel — controleer alle velden vóór je opslaat.",
  bestandsnaam: "Ingevuld op basis van de bestandsnaam — controleer de velden.",
  geen: "Niets automatisch herkend — vul de velden zelf in.",
};

/**
 * Sleep een polis-PDF hierop: het document wordt bewaard + gekoppeld en het
 * formulier opent (waar mogelijk) voorgevuld. Alles blijft aanpasbaar.
 */
export function PolisDropzone({ vmeId }: { vmeId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [over, setOver] = useState(false);
  const [resultaat, setResultaat] = useState<{
    documentId: string;
    naam: string;
    extract: PolisExtract;
  } | null>(null);

  const verwerk = (file: File) => {
    const fd = new FormData();
    fd.set("vme_id", vmeId);
    fd.set("file", file);
    start(async () => {
      const r = await verwerkPolisDocument(fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Document bewaard — controleer de polisgegevens.");
      setResultaat({
        documentId: r.document_id,
        naam: r.naam,
        extract: r.extract,
      });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) verwerk(file);
        }}
        disabled={pending}
        className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 text-sm transition-colors ${
          over ? "border-primary bg-primary/5" : "border-input"
        } ${pending ? "opacity-60" : "hover:border-primary/60"}`}
      >
        <Upload className="size-5 text-muted-foreground" />
        {pending ? (
          <span>Bezig met verwerken…</span>
        ) : (
          <>
            <span className="font-medium">
              Sleep hier een polis (PDF) — of klik om te kiezen
            </span>
            <span className="text-xs text-muted-foreground">
              Het document wordt bewaard en aan de polis gekoppeld.
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) verwerk(file);
          e.target.value = "";
        }}
      />

      <Dialog
        open={resultaat != null}
        onOpenChange={(o) => !o && setResultaat(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Polis uit document</DialogTitle>
          </DialogHeader>
          {resultaat && (
            <ActionForm
              action={createPolis}
              hiddenFields={{
                vme_id: vmeId,
                document_id: resultaat.documentId,
              }}
              onSuccess={() => setResultaat(null)}
              className="space-y-3"
            >
              <p className="rounded-md bg-muted/50 p-2 text-xs">
                📎 Gekoppeld: {resultaat.naam}
                <br />
                {BRON_TEKST[resultaat.extract.bron]}
              </p>
              <PolisVelden prefill={resultaat.extract} />
              <div className="space-y-1.5">
                <Label htmlFor="drop-opm">Opmerkingen (optioneel)</Label>
                <Textarea id="drop-opm" name="opmerkingen" rows={2} />
              </div>
              <DialogFooter>
                <SubmitButton>Polis opslaan</SubmitButton>
              </DialogFooter>
            </ActionForm>
          )}
        </DialogContent>
      </Dialog>
    </>
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
