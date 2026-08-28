import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
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
import type { Eigenaar, Unit } from "@/lib/types";
import { CreateEigenaarForm, EditEigenaarDialog } from "./eigenaar-forms";

export const metadata = { title: "Eigenaars" };

export default async function EigenaarsPage() {
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
  const { data: eigenaars } = unitIds.length
    ? await supabase
        .from("eigenaar")
        .select("*")
        .in("unit_id", unitIds)
        .order("naam")
        .returns<Eigenaar[]>()
    : { data: [] as Eigenaar[] };

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe eigenaar</CardTitle>
          <CardDescription>
            Maakt een gebruikersaccount aan (of hergebruikt een bestaand account
            op hetzelfde e-mailadres) en koppelt het aan een unit. De eigenaar
            krijgt een aanmeldlink per e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Maak eerst units aan.</p>
          ) : (
            <CreateEigenaarForm units={units} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eigenaars ({eigenaars?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!eigenaars || eigenaars.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen eigenaars.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eigenaars.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {[e.voornaam, e.naam].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell>{unitById.get(e.unit_id)?.naam ?? "—"}</TableCell>
                    <TableCell>{e.email ?? "—"}</TableCell>
                    <TableCell>{e.telefoon ?? "—"}</TableCell>
                    <TableCell>{e.structuurcode_prefix ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <EditEigenaarDialog eigenaar={e} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
