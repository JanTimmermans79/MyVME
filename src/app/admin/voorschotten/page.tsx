import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import { NoVme } from "@/components/no-vme";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
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
import type { Unit, Voorschot } from "@/lib/types";
import { deleteVoorschot } from "./actions";
import { CreateVoorschotForm } from "./voorschot-form";

export const metadata = { title: "Voorschotten" };

export default async function VoorschottenPage() {
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
  const { data: voorschotten } = unitIds.length
    ? await supabase
        .from("voorschot")
        .select("*")
        .in("unit_id", unitIds)
        .order("ingang_datum", { ascending: false })
        .returns<Voorschot[]>()
    : { data: [] as Voorschot[] };

  const unitById = new Map((units ?? []).map((u) => [u.id, u.naam]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuw voorschot</CardTitle>
          <CardDescription>
            Bij een tariefwijziging voeg je een nieuwe regel toe met een latere
            ingangsdatum. Het lopende saldo gebruikt automatisch het tarief dat
            per maand van toepassing was.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Maak eerst units aan.</p>
          ) : (
            <CreateVoorschotForm units={units} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voorschotten ({voorschotten?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!voorschotten || voorschotten.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen voorschotten.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Betaler</TableHead>
                  <TableHead className="text-right">Per maand</TableHead>
                  <TableHead>Vanaf</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {voorschotten.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{unitById.get(v.unit_id) ?? "—"}</TableCell>
                    <TableCell className="capitalize">{v.betaler_type}</TableCell>
                    <TableCell className="text-right">
                      {euro(v.bedrag_per_maand)}
                    </TableCell>
                    <TableCell>{datum(v.ingang_datum)}</TableCell>
                    <TableCell className="text-right">
                      <ActionForm action={deleteVoorschot} hiddenFields={{ id: v.id }}>
                        <ConfirmSubmit message="Voorschot verwijderen?" />
                      </ActionForm>
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
