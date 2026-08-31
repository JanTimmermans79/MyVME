"use client";

import { useTransition } from "react";
import { datum } from "@/lib/format";
import type { Boekjaar } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setTransactieBoekjaar } from "./actions";

const AUTO = "auto";

export function BoekjaarSelect({
  id,
  waarde,
  boekjaren,
}: {
  id: string;
  waarde: string | null;
  boekjaren: Boekjaar[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={waarde ?? AUTO}
      onValueChange={(v) =>
        startTransition(async () => {
          await setTransactieBoekjaar(id, v === AUTO ? "" : v);
        })
      }
    >
      <SelectTrigger size="sm" className="min-w-[11rem]" disabled={pending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>Automatisch (datum)</SelectItem>
        {boekjaren.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {datum(b.start_datum)} – {datum(b.eind_datum)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
