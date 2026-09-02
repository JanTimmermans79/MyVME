import { createClient } from "@/lib/supabase/server";
import { TerugLink } from "@/components/terug-link";
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
import { CreateUnitForm, EditUnitDialog } from "./units-forms";

export const metadata = { title: "Units" };

export default async function UnitsPage() {
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
        .returns<Eigenaar[]>()
    : { data: [] as Eigenaar[] };

  const eigenaarByUnit = new Map<string, Eigenaar[]>();
  for (const e of eigenaars ?? []) {
    const list = eigenaarByUnit.get(e.unit_id) ?? [];
    list.push(e);
    eigenaarByUnit.set(e.unit_id, list);
  }

  return (
    <div className="space-y-6">
      <TerugLink href="/admin/instellingen">Instellingen</TerugLink>
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe unit</CardTitle>
          <CardDescription>Kavels / appartementen van {active.naam}.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUnitForm vmeId={active.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units ({units?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen units.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Eigenaar(s)</TableHead>
                  <TableHead className="text-right">Quotiteit</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.naam}</TableCell>
                    <TableCell>
                      {(eigenaarByUnit.get(u.id) ?? [])
                        .map((e) => e.naam)
                        .join(", ") || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u.quotiteit ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <EditUnitDialog unit={u} />
                    </TableCell>
                  </TableRow>
                ))}
                {units.some((u) => u.quotiteit != null) && (
                  <TableRow>
                    <TableCell className="font-medium" colSpan={2}>
                      Totaal quotiteit
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {units.reduce((s, u) => s + (u.quotiteit ?? 0), 0)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
