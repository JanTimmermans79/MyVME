import { createClient } from "@/lib/supabase/server";
import { TerugLink } from "@/components/terug-link";
import { getActiveVme } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoVme } from "@/components/no-vme";
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
import { Badge } from "@/components/ui/badge";
import type { Huurder, Unit } from "@/lib/types";
import { AddHuurderDialog, EditHuurderDialog } from "./huurder-forms";

export const metadata = { title: "Huurders" };

export default async function HuurdersPage() {
  const { active } = await getActiveVme();
  if (!active) return <NoVme />;

  const supabase = await createClient();
  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .eq("vme_id", active.id)
    .order("naam")
    .returns<Unit[]>();

  const unitIds = (units ?? []).map((u) => u.id);
  const { data: huurders } = unitIds.length
    ? await supabase
        .from("huurder")
        .select("*")
        .in("unit_id", unitIds)
        .order("ingang_datum", { ascending: false })
        .returns<Huurder[]>()
    : { data: [] as Huurder[] };

  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));
  const vandaag = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <TerugLink href="/admin/instellingen">Instellingen</TerugLink>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Huurders</CardTitle>
            <CardDescription>
              Per appartement. De huurdatum en einddatum bepalen de pro-rata
              afrekening bij vertrek.
            </CardDescription>
          </div>
          {units && units.length > 0 && <AddHuurderDialog units={units} />}
        </CardHeader>
        <CardContent>
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Maak eerst units aan.</p>
          ) : !huurders || huurders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen huurders geregistreerd.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appartement</TableHead>
                    <TableHead>Huurder</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>IBAN</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {huurders.map((h) => {
                    const actief =
                      (!h.ingang_datum || h.ingang_datum <= vandaag) &&
                      (!h.uitgang_datum || h.uitgang_datum >= vandaag);
                    return (
                      <TableRow key={h.id}>
                        <TableCell>{unitNaam.get(h.unit_id) ?? "—"}</TableCell>
                        <TableCell className="font-medium">
                          {[h.voornaam, h.naam].filter(Boolean).join(" ")}
                          {actief ? (
                            <Badge variant="secondary" className="ml-2">
                              actief
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.email ?? "—"}
                          <br />
                          {h.telefoon ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {h.iban ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.ingang_datum ? datum(h.ingang_datum) : "?"} –{" "}
                          {h.uitgang_datum ? datum(h.uitgang_datum) : "heden"}
                        </TableCell>
                        <TableCell className="text-right">
                          <EditHuurderDialog huurder={h} />
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
