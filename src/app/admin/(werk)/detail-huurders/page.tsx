import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { laadHuurderContext } from "@/lib/huurder-detail";
import { euro, datum, saldoRichting } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Detail huurders" };

export default async function DetailHuurdersPage() {
  await requireAdmin();
  const ctx = await laadHuurderContext();
  if (!ctx) return <NoBoekjaar />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Detail huurders</h1>
        <p className="text-sm text-muted-foreground">
          Per huurder een detailkaart met meterstanden, verbruik en ontvangen
          voorschotten voor het boekjaar {datum(ctx.boekjaar.start_datum)} –{" "}
          {datum(ctx.boekjaar.eind_datum)}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Huurders ({ctx.resultaten.length})
          </CardTitle>
          <CardDescription>
            Klik op een huurder voor de detailkaart. De gegevens worden berekend
            uit Meterstanden, Tarieven, Kosten en Voorschotten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ctx.resultaten.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen huurders met een huurperiode in dit boekjaar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Huurder</TableHead>
                    <TableHead>Appartement</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Totaal kosten</TableHead>
                    <TableHead className="text-right">Voorschotten</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ctx.resultaten.map((h) => {
                    const r = saldoRichting(h.saldo);
                    return (
                      <TableRow key={h.huurder_id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/detail-huurders/${h.huurder_id}`}
                            className="hover:underline"
                          >
                            {h.huurder_naam}
                          </Link>
                        </TableCell>
                        <TableCell>{h.unit_naam}</TableCell>
                        <TableCell className="text-xs">
                          {datum(h.periode_start)} – {datum(h.periode_eind)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(h.totaal_kosten)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(h.voorschot_ontvangen)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={r.bijbetaling ? "destructive" : "secondary"}>
                            {euro(h.saldo)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
