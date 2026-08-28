"use client";

import { useRef } from "react";
import type { Vme } from "@/lib/types";
import { setActiveVme } from "@/app/admin/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VmeSwitcher({
  vmes,
  activeId,
}: {
  vmes: Vme[];
  activeId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (vmes.length === 0) return null;

  return (
    <form ref={formRef} action={setActiveVme}>
      <Select
        name="vme_id"
        defaultValue={activeId}
        onValueChange={() => formRef.current?.requestSubmit()}
      >
        <SelectTrigger size="sm" className="min-w-[10rem]">
          <SelectValue placeholder="Kies VME" />
        </SelectTrigger>
        <SelectContent>
          {vmes.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.naam}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
