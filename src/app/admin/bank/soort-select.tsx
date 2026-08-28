"use client";

import { useRef } from "react";
import { setTransactieSoort } from "./actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SOORTEN = [
  "voorschot",
  "kost",
  "afrekening",
  "interne_overboeking",
  "kapitaalsoproep",
  "rente",
  "terugbetaling",
  "overig",
];

export function SoortSelect({
  id,
  waarde,
}: {
  id: string;
  waarde: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  async function submit(formData: FormData) {
    await setTransactieSoort({ ok: false }, formData);
  }
  return (
    <form ref={formRef} action={submit}>
      <input type="hidden" name="id" value={id} />
      <Select
        name="soort"
        defaultValue={waarde}
        onValueChange={() => formRef.current?.requestSubmit()}
      >
        <SelectTrigger size="sm" className="min-w-[9rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOORTEN.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
