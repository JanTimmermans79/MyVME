"use client";

import { useState } from "react";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Verbruik5Jaar, VerbruikCijfer } from "@/lib/verbruik";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const m3 = (n: number) => `${n.toLocaleString("nl-BE", { maximumFractionDigits: 1 })} m³`;
const lit = (n: number) => `${n.toLocaleString("nl-BE", { maximumFractionDigits: 0 })} l`;

export function VerbruikOverzicht({ data }: { data: Verbruik5Jaar }) {
  const [sel, setSel] = useState<string>("blok");

  if (data.boekjaren.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen boekjaren met meterstanden.
      </p>
    );

  const rijen = data.boekjaren.map((bj) => {
    const c: VerbruikCijfer | undefined =
      sel === "blok" ? data.blok[bj.id] : data.perUnit[sel]?.[bj.id];
    return { label: bj.label, c };
  });
  const maxKost = Math.max(1, ...rijen.map((r) => r.c?.totaalKost ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSel("blok")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            sel === "blok"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Volledige blok
        </button>
        {data.units.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSel(u.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              sel === u.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {u.naam}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Boekjaar</TableHead>
              <TableHead className="text-right">Koud water</TableHead>
              <TableHead className="text-right">Warm water</TableHead>
              <TableHead className="text-right">Stookolie</TableHead>
              <TableHead className="text-right">Totaal kost</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rijen.map((r) => (
              <TableRow key={r.label}>
                <TableCell className="font-medium">{r.label}</TableCell>
                {r.c ? (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {m3(r.c.koud)}
                      <span className="block text-xs text-muted-foreground">
                        {euro(r.c.koudKost)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m3(r.c.warm)}
                      <span className="block text-xs text-muted-foreground">
                        {euro(r.c.warmKost)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lit(r.c.stookolieLiter)}
                      <span className="block text-xs text-muted-foreground">
                        {euro(r.c.stookolieKost)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {euro(r.c.totaalKost)}
                      {!r.c.volledig && (
                        <span
                          className="block text-xs text-amber-600"
                          title="Niet alle begin-/eindstanden zijn ingevoerd"
                        >
                          onvolledig
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div
                        className="h-2 rounded-sm bg-primary/70"
                        style={{
                          width: `${Math.max(2, (r.c.totaalKost / maxKost) * 100)}%`,
                        }}
                      />
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    geen gegevens
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
