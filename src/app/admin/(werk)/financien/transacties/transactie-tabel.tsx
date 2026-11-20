"use client";

import { useMemo, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { euro, datum } from "@/lib/format";
import { classificeerTransactie } from "./actions";

export interface TransactieRij {
  id: string;
  datum: string;
  bedrag: number;
  tegenpartij: string | null;
  iban: string | null;
  mededeling: string | null;
  /** Huidige keuze, zie classificeerTransactie. */
  keuze: string;
  /** Appartement + betaler bij een toegewezen voorschot. */
  toegewezen: string | null;
}

const OPTIES: { value: string; label: string }[] = [
  { value: "voorschot", label: "Voorschot" },
  { value: "kost:huurders:elektriciteit", label: "Kost huurders — Elektriciteit gemeenschap" },
  { value: "kost:huurders:schoonmaak", label: "Kost huurders — Schoonmaak" },
  { value: "kost:huurders:onderhoud", label: "Kost huurders — Onderhoud verwarming en water" },
  { value: "kost:huurders:diverse", label: "Kost huurders — Diverse" },
  { value: "kost:eigenaars:syndicus", label: "Kost eigenaars — Syndicus" },
  { value: "kost:eigenaars:verzekering", label: "Kost eigenaars — Verzekering" },
  { value: "kost:eigenaars:diverse", label: "Kost eigenaars — Diverse" },
  { value: "kost:eigenaars:grote werken", label: "Kost eigenaars — Grote werken" },
  { value: "kost:verbruik:koud water", label: "Verbruik — Koud water" },
  { value: "kost:verbruik:warm water", label: "Verbruik — Warm water" },
  { value: "kost:verbruik:centrale verwarming", label: "Verbruik — Centrale verwarming" },
  { value: "kost:verbruik:mazout", label: "Verbruik — Mazout" },
  { value: "interne_overboeking", label: "Interne overboeking" },
  { value: "afrekening", label: "Afrekening (vorig jaar)" },
  { value: "kapitaalsoproep", label: "Kapitaalsoproep" },
  { value: "rente", label: "Rente" },
  { value: "terugbetaling", label: "Terugbetaling" },
  { value: "overig", label: "Overig" },
];

const FILTERS: { value: string; label: string; test: (k: string) => boolean }[] = [
  { value: "alle", label: "Alle", test: () => true },
  { value: "voorschot", label: "Voorschotten", test: (k) => k === "voorschot" },
  { value: "kost", label: "Alle kosten", test: (k) => k.startsWith("kost:") },
  { value: "huurders", label: "Kost huurders", test: (k) => k.startsWith("kost:huurders:") },
  { value: "eigenaars", label: "Kost eigenaars", test: (k) => k.startsWith("kost:eigenaars:") },
  { value: "verbruik", label: "Verbruik", test: (k) => k.startsWith("kost:verbruik:") },
  { value: "kost-onbepaald", label: "Kost zonder rubriek", test: (k) => k === "kost" },
  {
    value: "overig",
    label: "Overige soorten",
    test: (k) => !k.startsWith("kost") && k !== "voorschot",
  },
];

function KeuzeSelect({ rij }: { rij: TransactieRij }) {
  const [waarde, setWaarde] = useState(rij.keuze);
  const [pending, start] = useTransition();
  // Een kost zonder rubriek ("kost") staat niet in de lijst: toon ze als open keuze.
  const heeftOptie = OPTIES.some((o) => o.value === waarde);

  function kies(nieuw: string) {
    const vorige = waarde;
    setWaarde(nieuw);
    const fd = new FormData();
    fd.set("id", rij.id);
    fd.set("keuze", nieuw);
    start(async () => {
      const res = await classificeerTransactie({ ok: false }, fd);
      if (res.ok) toast.success(res.message ?? "Opgeslagen.");
      else {
        setWaarde(vorige);
        toast.error(res.error ?? "Opslaan mislukt.");
      }
    });
  }

  return (
    <Select value={waarde} onValueChange={kies} disabled={pending}>
      <SelectTrigger size="sm" className="min-w-[17rem]">
        <SelectValue placeholder="Kies soort" />
      </SelectTrigger>
      <SelectContent>
        {!heeftOptie && (
          <SelectItem value={waarde}>
            {waarde === "kost" ? "Kost — rubriek kiezen…" : waarde.replace(/_/g, " ")}
          </SelectItem>
        )}
        {OPTIES.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const csvCel = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function TransactieTabel({
  rijen,
  bestandsnaam,
}: {
  rijen: TransactieRij[];
  bestandsnaam: string;
}) {
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState("alle");
  const [van, setVan] = useState("");
  const [tot, setTot] = useState("");

  const zichtbaar = useMemo(() => {
    const test = FILTERS.find((f) => f.value === filter)?.test ?? (() => true);
    const q = zoek.trim().toLowerCase();
    return rijen.filter(
      (r) =>
        test(r.keuze) &&
        (!van || r.datum >= van) &&
        (!tot || r.datum <= tot) &&
        (!q ||
          `${r.tegenpartij ?? ""} ${r.mededeling ?? ""} ${r.iban ?? ""} ${r.toegewezen ?? ""}`
            .toLowerCase()
            .includes(q)),
    );
  }, [rijen, zoek, filter, van, tot]);

  const totaal = zichtbaar.reduce((s, r) => s + r.bedrag, 0);

  function exporteer() {
    const label = (k: string) => OPTIES.find((o) => o.value === k)?.label ?? k;
    const regels = [
      ["Datum", "Bedrag", "Tegenpartij", "IBAN", "Mededeling", "Soort", "Toegewezen aan"],
      ...zichtbaar.map((r) => [
        r.datum,
        String(r.bedrag).replace(".", ","),
        r.tegenpartij,
        r.iban,
        r.mededeling,
        label(r.keuze),
        r.toegewezen,
      ]),
    ].map((r) => r.map(csvCel).join(";"));
    // BOM zodat Excel de accenten goed leest.
    const blob = new Blob(["﻿" + regels.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bestandsnaam}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="text-xs text-muted-foreground" htmlFor="tx-zoek">
            Zoeken
          </label>
          <Input
            id="tx-zoek"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Tegenpartij, mededeling, IBAN…"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Soort</label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="min-w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="tx-van">
            Van
          </label>
          <Input id="tx-van" type="date" value={van} onChange={(e) => setVan(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="tx-tot">
            Tot
          </label>
          <Input id="tx-tot" type="date" value={tot} onChange={(e) => setTot(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={exporteer}>
          <Download className="size-4" /> Exporteren (CSV)
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {zichtbaar.length} van {rijen.length} verrichtingen · totaal{" "}
        <strong className="tabular-nums">{euro(totaal)}</strong>
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead className="text-right">Bedrag</TableHead>
              <TableHead>Tegenpartij / mededeling</TableHead>
              <TableHead>Wat is dit?</TableHead>
              <TableHead>Toegewezen aan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zichtbaar.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Geen verrichtingen gevonden.
                </TableCell>
              </TableRow>
            ) : (
              zichtbaar.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{datum(r.datum)}</TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-right tabular-nums ${r.bedrag < 0 ? "" : "text-emerald-700"}`}
                  >
                    {euro(r.bedrag)}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="block truncate font-medium">
                      {r.tegenpartij ?? "—"}
                    </span>
                    {r.mededeling && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.mededeling}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <KeuzeSelect rij={r} />
                  </TableCell>
                  <TableCell className="text-xs">{r.toegewezen ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
