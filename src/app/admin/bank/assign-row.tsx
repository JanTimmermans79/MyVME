"use client";

import { useState } from "react";
import type { Unit } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignTransactie } from "./actions";

export function AssignRow({
  transactieId,
  units,
}: {
  transactieId: string;
  units: Unit[];
}) {
  const [unitId, setUnitId] = useState("");
  const [betaler, setBetaler] = useState("eigenaar");

  return (
    <ActionForm
      action={assignTransactie}
      hiddenFields={{
        id: transactieId,
        unit_id: unitId,
        betaler_type: betaler,
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <Select value={unitId} onValueChange={setUnitId}>
        <SelectTrigger size="sm" className="min-w-[10rem]">
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          {units.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.naam}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={betaler} onValueChange={setBetaler}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="eigenaar">Eigenaar</SelectItem>
          <SelectItem value="huurder">Huurder</SelectItem>
        </SelectContent>
      </Select>
      <SubmitButton variant="outline" size="sm">
        Toewijzen
      </SubmitButton>
    </ActionForm>
  );
}
