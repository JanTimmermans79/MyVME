"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  parseWorkbook,
  autoMap,
  buildTransactions,
  type Mapping,
  type Sheet,
  type Veld,
  type ParsedTx,
} from "@/lib/bank-parse";
import { euro, datum as fmtDatum } from "@/lib/format";
import { importTransacties } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const VELDEN: { value: Veld; label: string }[] = [
  { value: "datum", label: "Datum" },
  { value: "bedrag", label: "Bedrag" },
  { value: "tegenpartij_naam", label: "Tegenpartij (naam)" },
  { value: "tegenpartij_iban", label: "Tegenpartij (IBAN)" },
  { value: "mededeling", label: "Mededeling" },
  { value: "negeren", label: "— negeren —" },
];

export function BankImporter({ vmeId }: { vmeId: string }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [fileName, setFileName] = useState("");
  const [pending, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      if (parsed.columns.length === 0) {
        toast.error("Geen leesbare tabel gevonden in dit bestand.");
        return;
      }
      setSheet(parsed);
      setMapping(autoMap(parsed.columns));
    } catch {
      toast.error("Kon het bestand niet lezen. Is het een geldig XLS/XLSX?");
    }
  }

  const result = sheet ? buildTransactions(sheet, mapping) : null;

  function doImport() {
    if (!result || result.ok.length === 0) return;
    const fd = new FormData();
    fd.set("vme_id", vmeId);
    fd.set("rows", JSON.stringify(result.ok));
    startTransition(async () => {
      const res = await importTransacties({ ok: false }, fd);
      if (res.ok) {
        toast.success(res.message ?? "Geïmporteerd.");
        setSheet(null);
        setMapping({});
        setFileName("");
      } else {
        toast.error(res.error ?? "Import mislukt.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="bankfile">Bankexport (XLS / XLSX)</Label>
        <Input
          id="bankfile"
          type="file"
          accept=".xls,.xlsx,.csv"
          onChange={onFile}
        />
      </div>

      {sheet && (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">
              Kolommen toewijzen ({fileName})
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sheet.columns.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-40 truncate text-sm text-muted-foreground"
                    title={col}
                  >
                    {col || `Kolom ${i + 1}`}
                  </span>
                  <Select
                    value={mapping[i] ?? "negeren"}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [i]: v as Veld }))
                    }
                  >
                    <SelectTrigger size="sm" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VELDEN.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {result && (
            <>
              <p className="text-sm text-muted-foreground">
                {result.ok.length} leesbare transactie(s)
                {result.fouten.length > 0 &&
                  `, ${result.fouten.length} overgeslagen (${result.fouten
                    .slice(0, 3)
                    .map((f) => `rij ${f.rij}: ${f.reden}`)
                    .join("; ")}${result.fouten.length > 3 ? "…" : ""})`}
              </p>

              {result.ok.length > 0 && (
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Bedrag</TableHead>
                        <TableHead>Tegenpartij</TableHead>
                        <TableHead>IBAN</TableHead>
                        <TableHead>Mededeling</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.ok.slice(0, 50).map((t: ParsedTx, i) => (
                        <TableRow key={i}>
                          <TableCell>{fmtDatum(t.datum)}</TableCell>
                          <TableCell className="text-right">
                            {euro(t.bedrag)}
                          </TableCell>
                          <TableCell>{t.tegenpartij_naam ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {t.tegenpartij_iban ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {t.mededeling ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Button
                onClick={doImport}
                disabled={pending || result.ok.length === 0}
              >
                {pending
                  ? "Bezig…"
                  : `Importeer ${result.ok.length} transactie(s)`}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
