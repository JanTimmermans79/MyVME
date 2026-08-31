import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveVme } from "@/lib/vme-context";
import { euro, datum, saldoRichting } from "@/lib/format";
import { berekenEigenaarAfrekeningen } from "@/lib/afrekening";
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

export const metadata = { title: "Eigenaarafrekening" };

export default async function EigenaarAfrekeningDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boekjaar?: string }>;
}) {
  await requireAdmin();
  const { id: unitId } = await params;
  const sp = await searchParams;
  const boekjaarId = typeof sp.boekjaar === "string" ? sp.boekjaar : undefined;

  const { active } = await getActiveVme();
  const db = createAdminClient();

  const { data: boekjaar } = boekjaarId
    ? await db
        .from("boekjaar")
        .select("id, start_datum, eind_datum")
        .eq("id", boekjaarId)
        .maybeSingle<{ id: string; start_datum: string; eind_datum: string }>()
    : { data: null };
  if (!boekjaar) notFound();

  const { regels } = await berekenEigenaarAfrekeningen(db, boekjaar.id);
  const r = regels.find((x) => x.unit_id === unitId);
  if (!r) notFound();

  const richting = saldoRichting(r.saldo);
  const drilldown = `/admin/dashboard/spaar-uit?bj=${boekjaar.id}`;

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/afrekeningen?boekjaar=${boekjaar.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Alle afrekeningen
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            Eigenaarafrekening — {r.eigenaar_naam} ({r.unit_naam})
          </CardTitle>
          <CardDescription>
            Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}
            {r.eigenaar_email ? ` · ${r.eigenaar_email}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Aandeel in de eigenaarskosten
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kostenpost</TableHead>
                    <TableHead>Verdeling</TableHead>
                    <TableHead className="text-right">Totale kost</TableHead>
                    <TableHead className="text-right">Aandeel</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.lijnen.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-sm text-muted-foreground"
                      >
                        Geen eigenaarskosten in dit boekjaar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    r.lijnen.map((l) => (
                      <TableRow key={l.categorie}>
                        <TableCell className="capitalize">
                          <Link href={drilldown} className="hover:underline">
                            {l.categorie} →
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.verdeling.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(l.kost_totaal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.aandeel_pct.toLocaleString("nl-BE", {
                            maximumFractionDigits: 1,
                          })}{" "}
                          %
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(l.bedrag)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="font-medium">
                    <TableCell colSpan={4}>Totaal aandeel eigenaarskosten</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {euro(r.verschuldigd)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Operationele afrekening (zichtrekening)
            </h3>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Aandeel eigenaarskosten</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.verschuldigd)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    Betaalde eigenaarsvoorschotten (zichtrekening)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.ontvangen)}
                  </TableCell>
                </TableRow>
                <TableRow className="text-base font-semibold">
                  <TableCell>
                    Saldo —{" "}
                    <Badge
                      variant={richting.bijbetaling ? "destructive" : "secondary"}
                    >
                      {richting.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.saldo)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="mb-1 font-medium">
              Reservefonds (spaarrekening) — aparte stroom
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Ontvangen reservefonds­provisies dit boekjaar
              </span>
              <span className="tabular-nums">
                {euro(r.reservefonds_ontvangen)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Kapitaalopvragingen toegewezen aan deze kavel
              </span>
              <span className="tabular-nums">{euro(r.kapitaalopvraging)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Het reservefonds staat los van de jaarafrekening. Volledige controle
              via{" "}
              <Link
                href="/admin/financien/spaar/voorschotcontrole"
                className="underline"
              >
                Voorschotcontrole eigenaars
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      {active && (
        <p className="text-xs text-muted-foreground">{active.naam}</p>
      )}
    </div>
  );
}
