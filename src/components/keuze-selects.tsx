"use client";

import type { Boekjaar } from "@/lib/types";
import { datum } from "@/lib/format";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DocKeuze {
  id: string;
  naam: string;
}

/** <Select name="boekjaar_id"> met de boekjaren van de VME (optioneel veld). */
export function BoekjaarSelect({
  boekjaren,
  defaultValue,
  label = "Boekjaar (optioneel)",
}: {
  boekjaren: Boekjaar[];
  defaultValue?: string;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select name="boekjaar_id" defaultValue={defaultValue}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="(geen)" />
        </SelectTrigger>
        <SelectContent>
          {boekjaren.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {datum(b.start_datum)} – {datum(b.eind_datum)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** <Select name="document_id"> met de reeds geüploade documenten (optioneel). */
export function DocumentSelect({
  documenten,
  defaultValue,
  label = "Gekoppeld document (optioneel)",
  name = "document_id",
}: {
  documenten: DocKeuze[];
  defaultValue?: string;
  label?: string;
  name?: string;
}) {
  if (documenten.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="(geen)" />
        </SelectTrigger>
        <SelectContent>
          {documenten.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.naam}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
