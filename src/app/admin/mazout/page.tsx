import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
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
import type { MazoutLevering } from "@/lib/types";
import { createMazout, deleteMazout } from "./actions";

export const metadata = { title: "Mazout" };

export default async function MazoutPage() {
  const { vme: active, boekjaar } = await getActiveContext();
  if (!active || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();
  const { data: leveringen } = await supabase
    .from("mazout_levering")
    .select("*")
    .eq("vme_id", active.id)
    .gte("datum", boekjaar.start_datum)
    .lte("datum", boekjaar.eind_datum)
    .order("datum", { ascending: false })
    .returns<MazoutLevering[]>();

  const totaalLiter = (leveringen ?? []).reduce(
    (s, l) => s + Number(l.liter),
    0,
  );
  const totaalBedrag = (leveringen ?? []).reduce(
    (s, l) => s + Number(l.liter) * Number(l.prijs_per_liter),
    0,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe mazoutlevering</CardTitle>
          <CardDescription>Voor {active.naam}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createMazout}
            resetOnSuccess
            hiddenFields={{ vme_id: active.id }}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="Datum" name="datum" type="date" required />
            <Field label="Liter" name="liter" inputMode="decimal" required />
            <Field
              label="Prijs per liter (EUR)"
              name="prijs_per_liter"
              inputMode="decimal"
              required
            />
            <Field label="Leverancier" name="leverancier" />
            <SubmitButton>Registreren</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leveringen ({leveringen?.length ?? 0})</CardTitle>
          <CardDescription>
            Totaal: {totaalLiter.toLocaleString("nl-BE")} liter ·{" "}
            {euro(totaalBedrag)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!leveringen || leveringen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen leveringen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Leverancier</TableHead>
                  <TableHead className="text-right">Liter</TableHead>
                  <TableHead className="text-right">Prijs/l</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leveringen.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{datum(l.datum)}</TableCell>
                    <TableCell>{l.leverancier ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {Number(l.liter).toLocaleString("nl-BE")}
                    </TableCell>
                    <TableCell className="text-right">
                      {euro(l.prijs_per_liter)}
                    </TableCell>
                    <TableCell className="text-right">
                      {euro(Number(l.liter) * Number(l.prijs_per_liter))}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionForm action={deleteMazout} hiddenFields={{ id: l.id }}>
                        <ConfirmSubmit message="Levering verwijderen?" />
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
