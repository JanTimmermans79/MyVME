"use client";

import { useMemo, useState } from "react";
import type { Unit } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveAandelen } from "../actions";

export function AandeelMatrix({
  verdeelsleutelId,
  units,
  initial,
}: {
  verdeelsleutelId: string;
  units: Unit[];
  initial: Record<string, number>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      units.map((u) => [
        u.id,
        initial[u.id] !== undefined ? String(initial[u.id]) : "",
      ]),
    ),
  );

  const total = useMemo(
    () =>
      Object.values(values).reduce((sum, v) => {
        const n = Number(v.replace(",", "."));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [values],
  );

  return (
    <ActionForm
      action={saveAandelen}
      hiddenFields={{ verdeelsleutel_id: verdeelsleutelId }}
      className="space-y-4"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unit</TableHead>
            <TableHead className="w-40">Aandeel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.naam}</TableCell>
              <TableCell>
                <Label htmlFor={`aandeel_${u.id}`} className="sr-only">
                  Aandeel voor {u.naam}
                </Label>
                <Input
                  id={`aandeel_${u.id}`}
                  name={`aandeel_${u.id}`}
                  inputMode="decimal"
                  placeholder="—"
                  value={values[u.id] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [u.id]: e.target.value }))
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Som van de aandelen: <strong>{total.toLocaleString("nl-BE")}</strong>{" "}
          (mag elke schaal zijn; de afrekening gebruikt het relatieve aandeel)
        </span>
        <SubmitButton>Aandelen opslaan</SubmitButton>
      </div>
    </ActionForm>
  );
}
