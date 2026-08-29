import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
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
import type { Document } from "@/lib/types";
import {
  UploadDocumentenDialog,
  DeleteDocumentButton,
} from "./documenten-forms";

export const metadata = { title: "Documenten" };

function kb(n: number | null) {
  if (!n) return "—";
  return n < 1024 * 1024
    ? `${Math.round(n / 1024)} kB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentenPage() {
  const { vme, boekjaar } = await getActiveContext();
  if (!vme) return <NoVme />;

  const supabase = await createClient();
  const { data: documenten } = await supabase
    .from("document")
    .select("*")
    .eq("vme_id", vme.id)
    .order("created_at", { ascending: false })
    .returns<Document[]>();

  const boekjaarLabel = boekjaar
    ? `Boekjaar ${datum(boekjaar.start_datum)} – ${datum(boekjaar.eind_datum)}`
    : "";
  const ditBoekjaar = (documenten ?? []).filter(
    (d) => boekjaar && d.boekjaar_id === boekjaar.id,
  );
  const algemeen = (documenten ?? []).filter((d) => !d.boekjaar_id);
  const anderBoekjaar = (documenten ?? []).filter(
    (d) => d.boekjaar_id && (!boekjaar || d.boekjaar_id !== boekjaar.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Documenten</h1>
          <p className="text-sm text-muted-foreground">
            Notulen, contracten, facturen en andere stukken van {vme.naam}.
          </p>
        </div>
        <UploadDocumentenDialog
          vmeId={vme.id}
          boekjaarId={boekjaar?.id ?? null}
          boekjaarLabel={boekjaarLabel}
        />
      </div>

      <DocLijst
        titel={boekjaar ? boekjaarLabel : "Dit boekjaar"}
        docs={ditBoekjaar}
      />
      <DocLijst titel="Algemeen (hele VME)" docs={algemeen} />
      {anderBoekjaar.length > 0 && (
        <DocLijst titel="Andere boekjaren" docs={anderBoekjaar} />
      )}
    </div>
  );
}

function DocLijst({ titel, docs }: { titel: string; docs: Document[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {titel} ({docs.length})
        </CardTitle>
        {docs.length === 0 && (
          <CardDescription>Nog geen documenten.</CardDescription>
        )}
      </CardHeader>
      {docs.length > 0 && (
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead>Toegevoegd</TableHead>
                <TableHead className="text-right">Grootte</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link
                      href={`/admin/documenten/download?id=${d.id}`}
                      target="_blank"
                      className="flex items-center gap-2 font-medium underline-offset-2 hover:underline"
                    >
                      <FileText className="size-4 text-muted-foreground" />
                      {d.naam}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {d.categorie ? (
                      <Badge variant="outline" className="capitalize">
                        {d.categorie}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {datum(d.created_at)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {kb(d.grootte)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteDocumentButton id={d.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
