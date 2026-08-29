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
import { Badge } from "@/components/ui/badge";
import type { Bankrelatie, Verdeelsleutel } from "@/lib/types";
import {
  CreateBankrelatieForm,
  EditBankrelatieDialog,
} from "./bankrelatie-forms";

export const metadata = { title: "Bankrelaties" };

export default async function BankrelatiesPage() {
  const { active } = await getActiveVme();
  if (!active) return <NoVme />;

  const supabase = await createClient();
  const [{ data: relaties }, { data: sleutels }] = await Promise.all([
    supabase
      .from("bankrelatie")
      .select("*")
      .eq("vme_id", active.id)
      .order("naam")
      .returns<Bankrelatie[]>(),
    supabase
      .from("verdeelsleutel")
      .select("*")
      .eq("vme_id", active.id)
      .order("naam")
      .returns<Verdeelsleutel[]>(),
  ]);

  const sleutelNaam = new Map((sleutels ?? []).map((s) => [s.id, s.naam]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe bankrelatie</CardTitle>
          <CardDescription>
            Configureer bekende tegenpartijen (Watergroep, mazoutleverancier,
            elektriciteit, …). Bij de bankimport wordt een betaling naar/van deze
            IBAN automatisch herkend en voorzien van de standaardwaarden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateBankrelatieForm
            vmeId={active.id}
            verdeelsleutels={sleutels ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bankrelaties ({relaties?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!relaties || relaties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen bankrelaties.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>IBAN</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead>Verdeelsleutel</TableHead>
                    <TableHead>Verdeling</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relaties.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.naam}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.iban ?? r.mandaatreferte ?? r.naam_bevat ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.type}</Badge>
                      </TableCell>
                      <TableCell>{r.standaard_categorie ?? "—"}</TableCell>
                      <TableCell>
                        {r.standaard_verdeelsleutel_id
                          ? sleutelNaam.get(r.standaard_verdeelsleutel_id) ?? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {r.standaard_verdeling?.replace(/_/g, " ") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <EditBankrelatieDialog
                          br={r}
                          verdeelsleutels={sleutels ?? []}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
