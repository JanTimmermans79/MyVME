import { euro } from "@/lib/format";
import type { VoorschotRegel } from "@/lib/voorschot-controle";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function status(afwijking: number): { label: string; variant: "secondary" | "destructive" } {
  if (afwijking < -1) return { label: "Achterstand", variant: "destructive" };
  if (afwijking > 1) return { label: "Vooruit", variant: "secondary" };
  return { label: "OK", variant: "secondary" };
}

export function VoorschotcontroleTabel({
  regels,
  toonKapitaal = false,
}: {
  regels: VoorschotRegel[];
  toonKapitaal?: boolean;
}) {
  if (regels.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Geen voorschotten voor dit boekjaar.
      </p>
    );

  const opSchema = regels.filter((r) => Math.abs(r.afwijking) <= 1).length;

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <Badge variant={opSchema === regels.length ? "secondary" : "destructive"}>
          {opSchema} van {regels.length} op schema
        </Badge>
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Appartement</TableHead>
              <TableHead>Wie</TableHead>
              <TableHead className="text-right">Te betalen</TableHead>
              <TableHead className="text-right">Betaald</TableHead>
              {toonKapitaal && (
                <TableHead className="text-right">Kapitaalsopr.</TableHead>
              )}
              <TableHead className="text-right">Verschil</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regels.map((r, i) => {
              const st = status(r.afwijking);
              return (
                <TableRow key={i}>
                  <TableCell>{r.unit_naam}</TableCell>
                  <TableCell>{r.wie}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.verwacht)}
                    {r.verwachtVol !== r.verwacht && (
                      <span className="block text-xs text-muted-foreground">
                        volledig jaar {euro(r.verwachtVol)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.ontvangen)}
                  </TableCell>
                  {toonKapitaal && (
                    <TableCell className="text-right tabular-nums">
                      {r.kapitaalsoproep ? euro(r.kapitaalsoproep) : "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {euro(r.afwijking)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.variant}>{st.label}</Badge>
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
