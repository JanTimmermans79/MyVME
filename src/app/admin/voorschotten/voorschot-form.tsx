"use client";

import type { Unit } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createVoorschot } from "./actions";

export function CreateVoorschotForm({ units }: { units: Unit[] }) {
  return (
    <ActionForm
      action={createVoorschot}
      resetOnSuccess
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="unit_id">Unit</Label>
        <Select name="unit_id" required>
          <SelectTrigger id="unit_id" className="w-full">
            <SelectValue placeholder="Kies unit" />
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
      <div className="space-y-1.5">
        <Label htmlFor="betaler_type">Betaler</Label>
        <Select name="betaler_type" defaultValue="eigenaar">
          <SelectTrigger id="betaler_type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eigenaar">Eigenaar</SelectItem>
            <SelectItem value="huurder">Huurder</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field
        label="Bedrag per maand (EUR)"
        name="bedrag_per_maand"
        inputMode="decimal"
        required
      />
      <Field label="Ingangsdatum" name="ingang_datum" type="date" required />
      <div className="sm:col-span-2 lg:col-span-4">
        <SubmitButton>Voorschot toevoegen</SubmitButton>
      </div>
    </ActionForm>
  );
}
