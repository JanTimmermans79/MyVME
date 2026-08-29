import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoVme } from "@/components/no-vme";
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
import { Badge } from "@/components/ui/badge";
import type { Boekjaar } from "@/lib/types";
import {
  createBoekjaar,
  setBoekjaarStatus,
  deleteBoekjaar,
} from "./actions";

export const metadata = { title: "Boekjaren" };

export default async function BoekjarenPage() {
  const { active } = await getActiveVme();
  if (!active) return <NoVme />;

  const supabase = await createClient();
  const { data: boekjaren } = await supabase
    .from("boekjaar")
    .select("*")
    .eq("vme_id", active.id)
    .order("start_datum", { ascending: false })
    .returns<Boekjaar[]>();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuw boekjaar</CardTitle>
          <CardDescription>Voor {active.naam}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createBoekjaar}
            resetOnSuccess
            hiddenFields={{ vme_id: active.id }}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="Begindatum" name="start_datum" type="date" required />
            <Field label="Einddatum" name="eind_datum" type="date" required />
            <SubmitButton>Toevoegen</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Boekjaren</CardTitle>
        </CardHeader>
        <CardContent>
          {!boekjaren || boekjaren.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen boekjaren.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boekjaren.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {datum(b.start_datum)} – {datum(b.eind_datum)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={b.status === "open" ? "secondary" : "outline"}
                      >
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <ActionForm
                        action={setBoekjaarStatus}
                        hiddenFields={{
                          id: b.id,
                          status: b.status === "open" ? "afgesloten" : "open",
                        }}
                      >
                        <SubmitButton variant="outline" size="sm">
                          {b.status === "open" ? "Afsluiten" : "Heropenen"}
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteBoekjaar} hiddenFields={{ id: b.id }}>
                        <ConfirmSubmit message="Boekjaar verwijderen?" />
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
