"use client";

import { useMemo, useState } from "react";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Verbruik5Jaar } from "@/lib/verbruik";
import { LijnGrafiek, m3, type Punt } from "@/components/lijn-grafiek";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const REEKSEN: { id: string; label: string; euro: boolean }[] = [
  { id: "m3:koud", label: "Koud water (m³)", euro: false },
  { id: "m3:warm", label: "Warm water (m³)", euro: false },
  { id: "m3:cv", label: "Centrale verwarming (m³)", euro: false },
  { id: "eur:koud", label: "Koud water (€)", euro: true },
  { id: "eur:warm", label: "Warm water (€)", euro: true },
  { id: "eur:cv", label: "Stookolie (€)", euro: true },
  { id: "eur:totaal", label: "Verbruik totaal (€)", euro: true },
];

/**
 * Verbruiksevolutie over de boekjaren voor de appartementen van één eigenaar.
 * `verbruik.units` / `verbruik.blok` zijn al beperkt tot de eigen units.
 */
export function VerbruikGrafiek({ verbruik }: { verbruik: Verbruik5Jaar }) {
  const meerdere = verbruik.units.length > 1;
  const [reeks, setReeks] = useState("eur:totaal");
  const [scope, setScope] = useState<string>(
    meerdere ? "blok" : (verbruik.units[0]?.id ?? "blok"),
  );

  const euroAs = reeks.startsWith("eur:");

  const punten = useMemo<Punt[]>(() => {
    const [soort, teller] = reeks.split(":");
    return verbruik.boekjaren.map((bj) => {
      const c =
        scope === "blok" ? verbruik.blok[bj.id] : verbruik.perUnit[scope]?.[bj.id];
      let w: number | null = null;
      if (c) {
        if (soort === "m3")
          w = teller === "koud" ? c.koud : teller === "warm" ? c.warm : c.cv;
        else
          w =
            teller === "koud"
              ? c.koudKost
              : teller === "warm"
                ? c.warmKost
                : teller === "cv"
                  ? c.stookolieKost
                  : c.totaalKost;
      }
      return { boekjaar_id: bj.id, label: bj.label, waarde: w };
    });
  }, [reeks, scope, verbruik]);

  if (verbruik.boekjaren.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen verbruiksgeschiedenis.
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="vg-reeks">
          Reeks
        </label>
        <select
          id="vg-reeks"
          value={reeks}
          onChange={(e) => setReeks(e.target.value)}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm"
        >
          {REEKSEN.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {meerdere && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScope("blok")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              scope === "blok"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Samen
          </button>
          {verbruik.units.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setScope(u.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                scope === u.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {u.naam}
            </button>
          ))}
        </div>
      )}

      <LijnGrafiek punten={punten} euroAs={euroAs} />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Boekjaar</TableHead>
              <TableHead className="text-right">Waarde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {punten.map((p) => (
              <TableRow key={p.boekjaar_id}>
                <TableCell className="font-medium">{p.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.waarde == null
                    ? "—"
                    : euroAs
                      ? euro(p.waarde)
                      : m3(p.waarde)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
