import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { datum, euro } from "@/lib/format";
import { premiesVoorBoekjaar, vervaltStatus } from "@/lib/verzekering";
import { NoVme } from "@/components/no-vme";
import { TerugLink } from "@/components/terug-link";
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
import { POLIS_TYPE_LABEL, type VerzekeringPolis } from "@/lib/types";
import { CreatePolisForm, PolisDropzone } from "./verzekeringen-forms";

export const metadata = { title: "Verzekeringen" };

const VERVALT_BADGE: Record<
  "verlopen" | "binnenkort",
  { label: string; cls: string }
> = {
  verlopen: { label: "verlopen", cls: "bg-destructive/15 text-destructive" },
  binnenkort: {
    label: "vervalt binnenkort",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
};

export default async function VerzekeringenPage() {
  const { vme, boekjaar } = await getActiveContext();
  if (!vme) return <NoVme />;

  const supabase = await createClient();
  const [{ data: polisRows, error }, { data: docRows }] = await Promise.all([
    supabase
      .from("verzekering_polis")
      .select("*")
      .eq("vme_id", vme.id)
      .order("actief", { ascending: false })
      .order("maatschappij")
      .returns<VerzekeringPolis[]>(),
    supabase
      .from("document")
      .select("id, naam")
      .eq("vme_id", vme.id)
      .order("created_at", { ascending: false }),
  ]);

  const migratieNodig =
    error?.message?.toLowerCase().includes("verzekering_polis") ?? false;
  const polissen = polisRows ?? [];
  const documenten = (docRows ?? []) as { id: string; naam: string }[];

  const premies = boekjaar
    ? await premiesVoorBoekjaar(createAdminClient(), vme.id, boekjaar.id)
    : { totaal: 0, regels: [] };

  return (
    <div className="space-y-5">
      <TerugLink href="/admin/dashboard">Dashboard</TerugLink>

      <div>
        <h1 className="text-xl font-semibold">Verzekeringen</h1>
        <p className="text-sm text-muted-foreground">
          Polissen en schadedossiers van {vme.naam}.
        </p>
      </div>

      {migratieNodig && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          De verzekeringstabellen bestaan nog niet. Draai migratie{" "}
          <code>20260902120000_verzekering_module.sql</code> in de Supabase SQL
          Editor.
        </div>
      )}

      {boekjaar && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Betaalde premies dit boekjaar
            </CardTitle>
            <CardDescription>
              Kosten met categorie “verzekering”, {datum(boekjaar.start_datum)} –{" "}
              {datum(boekjaar.eind_datum)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">
              {euro(premies.totaal)}
            </span>
            <Link
              href="/admin/financien/spaar/kosten"
              className="text-sm text-primary hover:underline"
            >
              naar de kosten →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Polis via document</CardTitle>
          <CardDescription>
            Sleep een polis-PDF hierop; het document wordt bewaard en het
            formulier opent (waar mogelijk) voorgevuld.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PolisDropzone vmeId={vme.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Polis handmatig toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <CreatePolisForm vmeId={vme.id} documenten={documenten} />
        </CardContent>
      </Card>

      {polissen.length === 0 && !migratieNodig ? (
        <p className="text-sm text-muted-foreground">Nog geen polissen.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Maatschappij</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Polisnr.</TableHead>
                <TableHead className="text-right">Jaarpremie</TableHead>
                <TableHead>Vervaldag</TableHead>
                <TableHead>Makelaar</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {polissen.map((p) => {
                const vs = vervaltStatus(p);
                return (
                  <TableRow
                    key={p.id}
                    className={p.actief ? undefined : "opacity-60"}
                  >
                    <TableCell className="font-medium">
                      {p.maatschappij}
                      {!p.actief && (
                        <Badge variant="outline" className="ml-2">
                          inactief
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{POLIS_TYPE_LABEL[p.type]}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.polisnummer ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.jaarpremie != null ? euro(p.jaarpremie) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.vervaldatum
                        ? datum(p.vervaldatum)
                        : p.hoofdvervaldag
                          ? `jaarlijks · ${p.hoofdvervaldag}`
                          : "—"}
                      {vs !== "ok" && (
                        <span
                          className={`ml-1 rounded px-1 py-0.5 text-[10px] ${VERVALT_BADGE[vs].cls}`}
                        >
                          {VERVALT_BADGE[vs].label}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.makelaar ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/verzekeringen/${p.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        openen <ArrowRight className="size-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
