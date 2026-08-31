"use client";

import { useRouter } from "next/navigation";
import { euro, datum as fmtDatum } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VmeRekening } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface FinancieleRij {
  id: string;
  datum: string;
  omschrijving: string;
  tegenpartij: string | null;
  categorie: string | null;
  rekening: VmeRekening | null;
  bedrag: number;
  /** Detailpagina — maakt de rij klikbaar (spec §6). */
  href?: string;
  /** Extra cel-inhoud rechts (acties). Klikken hierop navigeert niet. */
  acties?: React.ReactNode;
}

/**
 * Eén vaste financiële tabel voor de hele app (spec §22).
 * Kolomvolgorde: Datum · Omschrijving · Leverancier/Tegenpartij · Categorie ·
 * Rekening · Bedrag. Bedragen rechts, tekst links, totaalrij onderaan.
 */
export function FinancieleTabel({
  rijen,
  totaalLabel = "Totaal",
  toonRekening = true,
  legeTekst = "Geen verrichtingen.",
}: {
  rijen: FinancieleRij[];
  totaalLabel?: string;
  toonRekening?: boolean;
  legeTekst?: string;
}) {
  const router = useRouter();

  if (rijen.length === 0)
    return <p className="text-sm text-muted-foreground">{legeTekst}</p>;

  const totaal = rijen.reduce((s, r) => s + r.bedrag, 0);
  const heeftActies = rijen.some((r) => r.acties);
  const spanTot = 3 + (toonRekening ? 1 : 0) + (heeftActies ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Omschrijving</TableHead>
            <TableHead>Leverancier / Tegenpartij</TableHead>
            <TableHead>Categorie</TableHead>
            {toonRekening && <TableHead>Rekening</TableHead>}
            <TableHead className="text-right">Bedrag</TableHead>
            {heeftActies && <TableHead className="text-right">Acties</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rijen.map((r) => (
            <TableRow
              key={r.id}
              className={cn(r.href && "cursor-pointer hover:bg-muted/50")}
              onClick={r.href ? () => router.push(r.href!) : undefined}
            >
              <TableCell className="whitespace-nowrap">
                {fmtDatum(r.datum)}
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {r.omschrijving || "—"}
              </TableCell>
              <TableCell>{r.tegenpartij ?? "—"}</TableCell>
              <TableCell className="capitalize">{r.categorie ?? "—"}</TableCell>
              {toonRekening && (
                <TableCell>
                  {r.rekening ? (
                    <Badge variant="outline" className="capitalize">
                      {r.rekening}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  r.bedrag < 0 && "text-destructive",
                )}
              >
                {euro(r.bedrag)}
              </TableCell>
              {heeftActies && (
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.acties}
                </TableCell>
              )}
            </TableRow>
          ))}
          <TableRow className="font-medium">
            <TableCell colSpan={spanTot}>{totaalLabel}</TableCell>
            <TableCell className="text-right tabular-nums">
              {euro(totaal)}
            </TableCell>
            {heeftActies && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
