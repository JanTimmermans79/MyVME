"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FinancieelJaar, GedeeldeKosten } from "@/lib/vme-dashboard";
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

// ---------------------------------------------------------------------------

const FINANCIEEL: { id: string; label: string }[] = [
  { id: "spaar-saldo", label: "Spaarrekening · saldo" },
  { id: "spaar-in", label: "Spaarrekening · inkomsten" },
  { id: "spaar-uit", label: "Spaarrekening · uitgaven" },
  { id: "zicht-saldo", label: "Zichtrekening · saldo" },
  { id: "zicht-in", label: "Zichtrekening · inkomsten" },
  { id: "zicht-uit", label: "Zichtrekening · uitgaven" },
];

const VERBRUIK: { id: string; label: string }[] = [
  { id: "m3:koud", label: "Koud water (m³)" },
  { id: "m3:warm", label: "Warm water (m³)" },
  { id: "m3:cv", label: "Centrale verwarming (m³)" },
  { id: "eur:koud", label: "Koud water (€)" },
  { id: "eur:warm", label: "Warm water (€)" },
  { id: "eur:cv", label: "Stookolie (€)" },
  { id: "eur:totaal", label: "Verbruik totaal (€)" },
];

const DRILLDOWN: Record<string, string> = {
  "spaar-in": "spaar-in",
  "spaar-uit": "spaar-uit",
  "zicht-in": "zicht-in",
  "zicht-uit": "zicht-uit",
};

export function EvolutieGrafiek({
  financieel,
  kosten,
  verbruik,
}: {
  financieel: FinancieelJaar[];
  kosten: GedeeldeKosten;
  verbruik: Verbruik5Jaar;
}) {
  const [metric, setMetric] = useState("spaar-saldo");
  const [scope, setScope] = useState("blok");

  const isVerbruik = metric.startsWith("m3:") || metric.startsWith("eur:");
  const euroAs = !metric.startsWith("m3:");

  const punten = useMemo<Punt[]>(() => {
    if (metric.startsWith("kost:")) {
      const cat = metric.slice(5);
      return kosten.jaren.map((j) => ({
        boekjaar_id: j.boekjaar_id,
        label: j.label,
        waarde: j.perCategorie[cat] ?? 0,
      }));
    }
    if (isVerbruik) {
      const [soort, teller] = metric.split(":");
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
    }
    const [rek, veld] = metric.split("-");
    const key = `${rek === "spaar" ? "spaar" : "zicht"}${
      veld === "in" ? "In" : veld === "uit" ? "Uit" : "Saldo"
    }` as keyof FinancieelJaar;
    return financieel.map((j) => ({
      boekjaar_id: j.boekjaar_id,
      label: j.label,
      waarde: (j[key] as number | null) ?? null,
    }));
  }, [metric, scope, isVerbruik, financieel, kosten, verbruik]);

  const rijHref = (bjId: string): string | null =>
    DRILLDOWN[metric] ? `/admin/dashboard/${DRILLDOWN[metric]}?bj=${bjId}` : null;

  const fmt = (v: number | null) =>
    v == null ? "—" : euroAs ? euro(v) : m3(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="evo-metric">
          Reeks
        </label>
        <select
          id="evo-metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm"
        >
          <optgroup label="Financieel">
            {FINANCIEEL.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
          {kosten.categorieen.length > 0 && (
            <optgroup label="Kosten per categorie">
              {kosten.categorieen.map((c) => (
                <option key={c} value={`kost:${c}`} className="capitalize">
                  {c}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Verbruik">
            {VERBRUIK.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {isVerbruik && (
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
            Volledige blok
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
            {punten.map((p) => {
              const href = rijHref(p.boekjaar_id);
              return (
                <TableRow key={p.boekjaar_id}>
                  <TableCell className="font-medium">{p.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {href ? (
                      <Link
                        href={href}
                        className="underline-offset-2 hover:underline"
                      >
                        {fmt(p.waarde)} →
                      </Link>
                    ) : (
                      fmt(p.waarde)
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
