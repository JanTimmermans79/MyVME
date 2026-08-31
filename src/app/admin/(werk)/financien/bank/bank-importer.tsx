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
import { importTransacties, parsePdfBankexport } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface PdfRij extends ParsedTx {
  mandaatreferte: string | null;
}
interface PdfResultaat {
  rekening: "zicht" | "spaar" | null;
  rekeningnummer: string | null;
  periode_van: string | null;
  periode_tot: string | null;
  saldo_begin: number | null;
  saldo_eind: number | null;
  txns: PdfRij[];
}

function PreviewTabel({ rows }: { rows: ParsedTx[] }) {
  return (
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
          {rows.slice(0, 60).map((t, i) => (
            <TableRow key={i}>
              <TableCell>{fmtDatum(t.datum)}</TableCell>
              <TableCell className="text-right">{euro(t.bedrag)}</TableCell>
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
  );
}

export function BankImporter({
  vmeId,
  boekjaarStart,
  boekjaarEind,
}: {
  vmeId: string;
  boekjaarStart: string;
  boekjaarEind: string;
}) {
  const [pending, startTransition] = useTransition();

  // XLS
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [fileName, setFileName] = useState("");

  // PDF
  const [pdf, setPdf] = useState<PdfResultaat | null>(null);
  const [pdfName, setPdfName] = useState("");

  async function onXls(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = parseWorkbook(await file.arrayBuffer());
      if (parsed.columns.length === 0) {
        toast.error("Geen leesbare tabel gevonden.");
        return;
      }
      setSheet(parsed);
      setMapping(autoMap(parsed.columns));
    } catch {
      toast.error("Kon het bestand niet lezen. Geldig XLS/XLSX?");
    }
  }

  function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfName(file.name);
    const fd = new FormData();
    fd.set("pdf", file);
    startTransition(async () => {
      const res = (await parsePdfBankexport({ ok: false }, fd)) as {
        ok: boolean;
        error?: string;
        message?: string;
        data?: PdfResultaat;
      };
      if (res.ok && res.data) {
        setPdf(res.data);
        toast.success(res.message ?? "PDF gelezen.");
      } else {
        toast.error(res.error ?? "Kon de PDF niet lezen.");
      }
    });
  }

  const xls = sheet ? buildTransactions(sheet, mapping) : null;

  function importeer(
    rows: ParsedTx[],
    bron: "xls" | "pdf",
    rekening?: string,
    meta?: {
      periode_van?: string | null;
      periode_tot?: string | null;
      saldo_begin?: number | null;
      saldo_eind?: number | null;
      bestandsnaam?: string | null;
    },
  ) {
    if (rows.length === 0) return;
    const fd = new FormData();
    fd.set("vme_id", vmeId);
    fd.set("rows", JSON.stringify(rows));
    fd.set("bron", bron);
    if (rekening) fd.set("rekening", rekening);

    const datums = rows.map((r) => r.datum).filter(Boolean).sort();
    fd.set("periode_van", meta?.periode_van ?? datums[0] ?? "");
    fd.set("periode_tot", meta?.periode_tot ?? datums[datums.length - 1] ?? "");
    if (meta?.saldo_begin != null) fd.set("saldo_begin", String(meta.saldo_begin));
    if (meta?.saldo_eind != null) fd.set("saldo_eind", String(meta.saldo_eind));
    if (meta?.bestandsnaam) fd.set("bestandsnaam", meta.bestandsnaam);

    startTransition(async () => {
      const res = await importTransacties({ ok: false }, fd);
      if (res.ok) {
        toast.success(res.message ?? "Geïmporteerd.");
        setSheet(null);
        setMapping({});
        setFileName("");
        setPdf(null);
        setPdfName("");
      } else {
        toast.error(res.error ?? "Import mislukt.");
      }
    });
  }

  return (
    <Tabs defaultValue="pdf" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pdf">PDF (KBC)</TabsTrigger>
        <TabsTrigger value="xls">XLS / XLSX</TabsTrigger>
      </TabsList>

      <TabsContent value="pdf" className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pdffile">KBC-rekeninguittreksel (PDF)</Label>
          <Input id="pdffile" type="file" accept=".pdf" onChange={onPdf} />
        </div>

        {pdf && (
          <>
            {pdf.periode_van &&
              pdf.periode_tot &&
              (pdf.periode_tot < boekjaarStart ||
                pdf.periode_van > boekjaarEind) && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  ⚠ Dit uittreksel ({pdf.periode_van} → {pdf.periode_tot}) valt
                  buiten het geselecteerde boekjaar ({boekjaarStart} →{" "}
                  {boekjaarEind}). Kies bovenaan het juiste boekjaar of upload een
                  ander bestand.
                </p>
              )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">
                {pdf.rekening === "spaar"
                  ? "Spaarrekening (reservefonds)"
                  : pdf.rekening === "zicht"
                    ? "Zichtrekening (werkrekening)"
                    : "Rekening onbekend"}
              </Badge>
              <span className="text-muted-foreground">
                {pdf.rekeningnummer} · {pdf.periode_van} → {pdf.periode_tot} ·{" "}
                {pdf.txns.length} verrichtingen
              </span>
              {pdf.saldo_begin != null && pdf.saldo_eind != null && (
                <Badge
                  variant={
                    Math.abs(
                      pdf.saldo_begin +
                        pdf.txns.reduce((s, t) => s + t.bedrag, 0) -
                        pdf.saldo_eind,
                    ) < 0.02
                      ? "secondary"
                      : "destructive"
                  }
                >
                  saldo {euro(pdf.saldo_begin)} → {euro(pdf.saldo_eind)}
                </Badge>
              )}
            </div>
            <PreviewTabel rows={pdf.txns} />
            <Button
              onClick={() =>
                importeer(pdf.txns, "pdf", pdf.rekening ?? undefined, {
                  periode_van: pdf.periode_van,
                  periode_tot: pdf.periode_tot,
                  saldo_begin: pdf.saldo_begin,
                  saldo_eind: pdf.saldo_eind,
                  bestandsnaam: pdfName,
                })
              }
              disabled={pending}
            >
              {pending ? "Bezig…" : `Importeer ${pdf.txns.length} verrichtingen`}
            </Button>
          </>
        )}
      </TabsContent>

      <TabsContent value="xls" className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="xlsfile">Bankexport (XLS / XLSX / CSV)</Label>
          <Input
            id="xlsfile"
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={onXls}
          />
        </div>

        {sheet && (
          <>
            <p className="text-sm font-medium">Kolommen toewijzen ({fileName})</p>
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

            {xls && (
              <>
                <p className="text-sm text-muted-foreground">
                  {xls.ok.length} leesbare verrichting(en)
                  {xls.fouten.length > 0 &&
                    `, ${xls.fouten.length} overgeslagen`}
                </p>
                {xls.ok.length > 0 && <PreviewTabel rows={xls.ok} />}
                <Button
                  onClick={() =>
                    importeer(xls.ok, "xls", "zicht", { bestandsnaam: fileName })
                  }
                  disabled={pending || xls.ok.length === 0}
                >
                  {pending ? "Bezig…" : `Importeer ${xls.ok.length} verrichtingen`}
                </Button>
              </>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
