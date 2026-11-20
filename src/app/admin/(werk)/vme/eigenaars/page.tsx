import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { NoVme } from "@/components/no-vme";
import { datum } from "@/lib/format";
import { isActiefEigenaar } from "@/lib/archief";
import { Button } from "@/components/ui/button";
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
import {
  ArchiefEigenaarActies,
  CreateEigenaarForm,
  EigenaarKaart,
} from "./eigenaar-forms";

export const metadata = { title: "Eigenaars" };

export default async function EigenaarsPage({
  searchParams,
}: {
  searchParams: Promise<{ archief?: string }>;
}) {
  const { archief } = await searchParams;
  const toonArchief = archief === "1";

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
        .order("naam")
        .returns<Eigenaar[]>()
    : { data: [] as Eigenaar[] };

  const lijst = eigenaars ?? [];
  const actief = lijst.filter((e) => isActiefEigenaar(e));
  const gearchiveerd = lijst
    .filter((e) => !isActiefEigenaar(e))
    .sort((a, b) => (b.eind_datum ?? "").localeCompare(a.eind_datum ?? ""));
  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));

  if (toonArchief)
    return (
      <div className="space-y-5">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Archief eigenaars ({gearchiveerd.length})</CardTitle>
              <CardDescription>
                Vorige eigenaars blijven bewaard voor de historiek.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/vme/eigenaars">Actieve eigenaars</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {gearchiveerd.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen gearchiveerde eigenaars.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Eigenaar</TableHead>
                    <TableHead>Kavel</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gearchiveerd.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {[e.voornaam, e.naam].filter(Boolean).join(" ")}
                      </TableCell>
                      <TableCell>{unitNaam.get(e.unit_id) ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {e.ingang_datum ? datum(e.ingang_datum) : "?"} –{" "}
                        {e.eind_datum ? datum(e.eind_datum) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.email ?? "—"}
                        <br />
                        {e.telefoon ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ArchiefEigenaarActies eigenaar={e} />
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

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Eigenaars ({actief.length})</CardTitle>
            <CardDescription>
              Per kavel de huidige eigenaar met zijn gegevens. Wordt een kavel
              verkocht, dan verplaats je de eigenaar naar het archief en voeg je
              de nieuwe eigenaar toe.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/vme/eigenaars?archief=1">
              Archief eigenaars ({gearchiveerd.length})
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Maak eerst kavels aan bij Structuur.
            </p>
          ) : (
            units.map((u) => {
              const eigenaarsVanUnit = actief.filter((e) => e.unit_id === u.id);
              return (
                <section key={u.id} className="space-y-2">
                  <h3 className="text-sm font-semibold">{u.naam}</h3>
                  {eigenaarsVanUnit.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Geen actieve eigenaar. Voeg er hieronder een toe.
                    </p>
                  ) : (
                    eigenaarsVanUnit.map((e) => (
                      <EigenaarKaart key={e.id} eigenaar={e} units={units} />
                    ))
                  )}
                </section>
              );
            })
          )}
        </CardContent>
      </Card>

      {units && units.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nieuwe eigenaar</CardTitle>
            <CardDescription>
              Maakt een gebruikersaccount aan (of hergebruikt een bestaand account
              op hetzelfde e-mailadres) en koppelt het aan het gekozen kavel. De
              eigenaar krijgt een aanmeldlink per e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateEigenaarForm units={units} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
