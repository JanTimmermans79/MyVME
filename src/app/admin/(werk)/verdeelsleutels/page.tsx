import Link from "next/link";
import { TerugLink } from "@/components/terug-link";
import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { NoVme } from "@/components/no-vme";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
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
import type { Verdeelsleutel, VerdeelsleutelAandeel } from "@/lib/types";
import { createVerdeelsleutel } from "./actions";

export const metadata = { title: "Verdeelsleutels" };

export default async function VerdeelsleutelsPage() {
  const { active } = await getActiveVme();
  if (!active) return <NoVme />;

  const supabase = await createClient();
  const { data: sleutels } = await supabase
    .from("verdeelsleutel")
    .select("*")
    .eq("vme_id", active.id)
    .order("naam")
    .returns<Verdeelsleutel[]>();

  const ids = (sleutels ?? []).map((s) => s.id);
  const { data: aandelen } = ids.length
    ? await supabase
        .from("verdeelsleutel_aandeel")
        .select("*")
        .in("verdeelsleutel_id", ids)
        .returns<VerdeelsleutelAandeel[]>()
    : { data: [] as VerdeelsleutelAandeel[] };

  const stats = new Map<string, { units: number; totaal: number }>();
  for (const a of aandelen ?? []) {
    const s = stats.get(a.verdeelsleutel_id) ?? { units: 0, totaal: 0 };
    s.units += 1;
    s.totaal += Number(a.aandeel);
    stats.set(a.verdeelsleutel_id, s);
  }

  return (
    <div className="space-y-6">
      <TerugLink href="/admin/instellingen">Instellingen</TerugLink>
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe verdeelsleutel</CardTitle>
          <CardDescription>
            Bv. &quot;Algemeen&quot;, &quot;Lift&quot;, &quot;Mazout&quot;. Aandelen stel je in per
            sleutel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createVerdeelsleutel}
            resetOnSuccess
            hiddenFields={{ vme_id: active.id }}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="Naam" name="naam" required className="min-w-[14rem]" />
            <Field
              label="Type (optioneel)"
              name="type"
              placeholder="bv. quotiteit, verbruik"
            />
            <SubmitButton>Toevoegen</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verdeelsleutels ({sleutels?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!sleutels || sleutels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen verdeelsleutels.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Units met aandeel</TableHead>
                  <TableHead className="text-right">Som aandelen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sleutels.map((s) => {
                  const st = stats.get(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/verdeelsleutels/${s.id}`}
                          className="underline"
                        >
                          {s.naam}
                        </Link>
                      </TableCell>
                      <TableCell>{s.type ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {st?.units ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {(st?.totaal ?? 0).toLocaleString("nl-BE")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
