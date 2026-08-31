import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TerugLink } from "@/components/terug-link";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Unit, Verdeelsleutel, VerdeelsleutelAandeel } from "@/lib/types";
import { updateVerdeelsleutel, deleteVerdeelsleutel } from "../actions";
import { AandeelMatrix } from "./aandeel-matrix";

export default async function VerdeelsleutelDetail({
  params,
}: PageProps<"/admin/verdeelsleutels/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sleutel } = await supabase
    .from("verdeelsleutel")
    .select("*")
    .eq("id", id)
    .maybeSingle<Verdeelsleutel>();

  if (!sleutel) notFound();

  const [{ data: units }, { data: aandelen }] = await Promise.all([
    supabase
      .from("unit")
      .select("*")
      .eq("vme_id", sleutel.vme_id)
      .order("naam")
      .returns<Unit[]>(),
    supabase
      .from("verdeelsleutel_aandeel")
      .select("*")
      .eq("verdeelsleutel_id", id)
      .returns<VerdeelsleutelAandeel[]>(),
  ]);

  const initial: Record<string, number> = {};
  for (const a of aandelen ?? []) initial[a.unit_id] = Number(a.aandeel);

  return (
    <div className="space-y-6">
      <TerugLink href="/admin/verdeelsleutels">Verdeelsleutels</TerugLink>

      <Card>
        <CardHeader>
          <CardTitle>Verdeelsleutel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ActionForm
            action={updateVerdeelsleutel}
            hiddenFields={{ id: sleutel.id }}
            className="flex flex-wrap items-end gap-3"
          >
            <Field
              label="Naam"
              name="naam"
              required
              defaultValue={sleutel.naam}
            />
            <Field
              label="Type"
              name="type"
              defaultValue={sleutel.type ?? ""}
            />
            <SubmitButton>Opslaan</SubmitButton>
          </ActionForm>
          <div className="border-t pt-3">
            <ActionForm
              action={deleteVerdeelsleutel}
              hiddenFields={{ id: sleutel.id }}
              redirectOnSuccess="/admin/verdeelsleutels"
            >
              <ConfirmSubmit message={`Verdeelsleutel "${sleutel.naam}" verwijderen?`} />
            </ActionForm>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aandelen per unit</CardTitle>
        </CardHeader>
        <CardContent>
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Maak eerst units aan.
            </p>
          ) : (
            <AandeelMatrix
              verdeelsleutelId={sleutel.id}
              units={units}
              initial={initial}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
