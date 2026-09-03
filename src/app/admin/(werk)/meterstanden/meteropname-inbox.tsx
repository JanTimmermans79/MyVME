"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Meteropname } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { bevestigMeteropname, wijsMeteropnameAf } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  koud_water: "Koud water",
  warm_water: "Warm water",
  cv: "CV / verwarming",
};

const AANLEIDING_OPTIES = [
  { value: "boekjaareinde", label: "Einde boekjaar" },
  { value: "einde_huurder", label: "Einde huurder" },
  { value: "start_huurder", label: "Start nieuwe huurder" },
  { value: "tussentijds", label: "Tussentijds" },
];
const HUURDER_AANLEIDINGEN = new Set(["einde_huurder", "start_huurder"]);

export interface InboxItem {
  opname: Meteropname;
  unitNaam: string;
  tellers: { id: string; type: string; meternummer: string | null }[];
  huurders: { id: string; naam: string }[];
  fotoUrl: string | null;
}

export function MeteropnameInbox({
  items,
  boekjaarStart,
  boekjaarEind,
}: {
  items: InboxItem[];
  boekjaarStart: string;
  boekjaarEind: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Foto-opnames{" "}
          <Badge variant="secondary" className="ml-1">
            {items.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Ingediende tellerfoto&apos;s die nog een meterstand moeten worden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <InboxRij
            key={item.opname.id}
            item={item}
            boekjaarStart={boekjaarStart}
            boekjaarEind={boekjaarEind}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function InboxRij({
  item,
  boekjaarStart,
  boekjaarEind,
}: {
  item: InboxItem;
  boekjaarStart: string;
  boekjaarEind: string;
}) {
  const { opname, unitNaam, tellers, huurders, fotoUrl } = item;
  const [open, setOpen] = useState(false);
  const [tellerId, setTellerId] = useState(
    opname.teller_id ?? (tellers.length === 1 ? tellers[0].id : ""),
  );
  const [aanleiding, setAanleiding] = useState("boekjaareinde");
  const vraagtHuurder = HUURDER_AANLEIDINGEN.has(aanleiding);
  const startWaarde = opname.waarde ?? opname.herkende_waarde ?? "";

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md border p-3">
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoUrl}
          alt="Tellerfoto"
          className="h-20 w-20 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded bg-muted text-xs text-muted-foreground">
          geen foto
        </div>
      )}

      <div className="min-w-40 flex-1 space-y-0.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{unitNaam}</span>
          <Badge variant="outline" className="text-[10px]">
            {opname.rol}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {opname.opname_datum
            ? new Date(`${opname.opname_datum}T00:00:00`).toLocaleDateString(
                "nl-BE",
              )
            : "datum onbekend"}
          {" · "}
          herkend: {opname.herkende_waarde ?? "?"}
          {opname.herkend_meternummer
            ? ` · nr. ${opname.herkend_meternummer}`
            : ""}
        </p>
      </div>

      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Bevestigen</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Meterstand bevestigen — {unitNaam}</DialogTitle>
            </DialogHeader>
            {fotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoUrl}
                alt="Tellerfoto"
                className="max-h-56 w-full rounded-md border object-contain"
              />
            )}
            <ActionForm
              action={bevestigMeteropname}
              hiddenFields={{
                opname_id: opname.id,
                teller_id: tellerId,
                aanleiding,
                boekjaar_start: boekjaarStart,
                boekjaar_eind: boekjaarEind,
              }}
              onSuccess={() => setOpen(false)}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label>Teller</Label>
                <Select value={tellerId} onValueChange={setTellerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="(kies teller)" />
                  </SelectTrigger>
                  <SelectContent>
                    {tellers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {TYPE_LABEL[t.type] ?? t.type}
                        {t.meternummer ? ` · nr. ${t.meternummer}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Datum"
                  name="datum"
                  type="date"
                  required
                  defaultValue={opname.opname_datum ?? boekjaarEind}
                  min={boekjaarStart}
                  max={boekjaarEind}
                />
                <Field
                  label="Meterstand (m³)"
                  name="waarde"
                  inputMode="decimal"
                  required
                  defaultValue={String(startWaarde)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Aanleiding</Label>
                <Select value={aanleiding} onValueChange={setAanleiding}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AANLEIDING_OPTIES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {vraagtHuurder && huurders.length > 0 && (
                <div className="space-y-1.5">
                  <Label>
                    {aanleiding === "start_huurder"
                      ? "Nieuwe huurder (ijkpunt)"
                      : "Vertrekkende huurder (eindstand)"}
                  </Label>
                  <Select name="huurder_id">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="(kies huurder)" />
                    </SelectTrigger>
                    <SelectContent>
                      {huurders.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.naam}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <SubmitButton>Meterstand opslaan</SubmitButton>
              </DialogFooter>
            </ActionForm>
            <ActionForm
              action={wijsMeteropnameAf}
              hiddenFields={{ opname_id: opname.id }}
              onSuccess={() => {
                setOpen(false);
                toast.message("Foto-opname afgewezen.");
              }}
              className="border-t pt-3"
            >
              <ConfirmSubmit
                size="sm"
                variant="ghost"
                message="Deze foto-opname afwijzen?"
              >
                Afwijzen
              </ConfirmSubmit>
            </ActionForm>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
