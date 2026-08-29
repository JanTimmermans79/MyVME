import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { genereerKostenUitBank } from "./actions";
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
import type { Kosten, Verdeelsleutel } from "@/lib/types";
import {
  CreateKostForm,
  EditKostDialog,
  ConfirmKostButton,
  DeleteKostButton,
} from "./kosten-forms";

export const metadata = { title: "Kosten" };

export default async function KostenPage() {
  const { vme: active, boekjaar, boekjaren } = await getActiveContext();
  if (!active || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();
  const [{ data: sleutels }, { data: kosten }] = await Promise.all([
    supabase
      .from("verdeelsleutel")
      .select("*")
      .eq("vme_id", active.id)
      .order("naam")
      .returns<Verdeelsleutel[]>(),
    supabase
      .from("kosten")
      .select("*")
      .eq("boekjaar_id", boekjaar.id)
      .order("datum", { ascending: false })
      .returns<Kosten[]>(),
  ]);

  const sleutelById = new Map((sleutels ?? []).map((s) => [s.id, s.naam]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Kosten uit de bankimport</CardTitle>
            <CardDescription>
              Maakt kostenvoorstellen uit betalingen (soort “kost”) die aan een
              bankrelatie gekoppeld zijn. Bevestig ze daarna in de lijst.
            </CardDescription>
          </div>
          <ActionForm
            action={genereerKostenUitBank}
            hiddenFields={{ vme_id: active.id }}
          >
            <SubmitButton size="sm">Genereer uit bank</SubmitButton>
          </ActionForm>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kost manueel boeken</CardTitle>
          <CardDescription>
            Bewijsstukken worden privé bewaard in Supabase Storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!boekjaren || boekjaren.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Maak eerst een boekjaar aan.
            </p>
          ) : (
            <CreateKostForm
              vmeId={active.id}
              boekjaren={boekjaren}
              verdeelsleutels={sleutels ?? []}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kosten ({kosten?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!kosten || kosten.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen kosten.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead>Leverancier</TableHead>
                    <TableHead>Sleutel</TableHead>
                    <TableHead>Verdeling</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kosten.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>{datum(k.datum)}</TableCell>
                      <TableCell>{k.categorie}</TableCell>
                      <TableCell>{k.leverancier ?? "—"}</TableCell>
                      <TableCell>
                        {k.verdeelsleutel_id ? (
                          sleutelById.get(k.verdeelsleutel_id) ?? "—"
                        ) : (
                          <span className="text-destructive">niet toegewezen</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {k.verdeling.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-right">{euro(k.bedrag)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            k.status === "bevestigd" ? "secondary" : "outline"
                          }
                        >
                          {k.status}
                          {k.bron === "ai_voorstel" ? " · AI" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {k.document_url && (
                            <Link
                              href={`/admin/kosten/document?path=${encodeURIComponent(k.document_url)}`}
                              target="_blank"
                              className="text-sm underline"
                            >
                              Bewijs
                            </Link>
                          )}
                          {k.status === "voorstel" && (
                            <ConfirmKostButton id={k.id} />
                          )}
                          <EditKostDialog
                            kost={k}
                            boekjaren={boekjaren}
                            verdeelsleutels={sleutels ?? []}
                          />
                          <DeleteKostButton id={k.id} />
                        </div>
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
