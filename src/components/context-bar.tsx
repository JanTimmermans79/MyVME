"use client";

import { useRef, useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { Boekjaar, Vme } from "@/lib/types";
import { datum } from "@/lib/format";
import {
  setActiveVme,
  setActiveBoekjaar,
  nieuwBoekjaar,
} from "@/app/admin/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
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

function AutoSelect({
  name,
  value,
  action,
  children,
  placeholder,
}: {
  name: string;
  value: string;
  action: (fd: FormData) => void | Promise<void>;
  children: React.ReactNode;
  placeholder?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action}>
      <Select
        name={name}
        value={value}
        onValueChange={() => formRef.current?.requestSubmit()}
      >
        <SelectTrigger size="sm" className="min-w-[12rem]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </form>
  );
}

export function ContextBar({
  vmes,
  vme,
  boekjaren,
  boekjaar,
  canCreateBoekjaar = true,
}: {
  vmes: Vme[];
  vme: Vme | null;
  boekjaren: Boekjaar[];
  boekjaar: Boekjaar | null;
  canCreateBoekjaar?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
        VME
      </span>
      {vmes.length > 1 ? (
        <AutoSelect
          name="vme_id"
          value={vme?.id ?? ""}
          action={setActiveVme}
          placeholder="Kies VME"
        >
          {vmes.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.naam}
            </SelectItem>
          ))}
        </AutoSelect>
      ) : (
        <span className="text-sm font-medium">{vme?.naam ?? "—"}</span>
      )}

      <span className="mx-1 text-muted-foreground">·</span>
      <span className="text-xs font-medium text-muted-foreground">Boekjaar</span>

      {boekjaren.length > 0 ? (
        <AutoSelect
          name="boekjaar_id"
          value={boekjaar?.id ?? ""}
          action={setActiveBoekjaar}
          placeholder="Kies boekjaar"
        >
          {boekjaren.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {datum(b.start_datum)} – {datum(b.eind_datum)}
              {b.status === "afgesloten" ? " (afgesloten)" : ""}
            </SelectItem>
          ))}
        </AutoSelect>
      ) : (
        <span className="text-sm text-muted-foreground">geen boekjaar</span>
      )}

      {!canCreateBoekjaar ? null : (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={!vme}>
            <CalendarPlus className="size-3.5" /> Nieuw boekjaar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuw boekjaar voor {vme?.naam}</DialogTitle>
          </DialogHeader>
          <ActionForm
            action={nieuwBoekjaar}
            hiddenFields={{ vme_id: vme?.id ?? "" }}
            onSuccess={() => setOpen(false)}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Begindatum" name="start_datum" type="date" required />
              <Field label="Einddatum" name="eind_datum" type="date" required />
            </div>
            <DialogFooter>
              <SubmitButton>Aanmaken</SubmitButton>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
