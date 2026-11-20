import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { NoVme } from "@/components/no-vme";
import { datum } from "@/lib/format";
import { isActiefHuurder } from "@/lib/archief";
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
import type { Huurder, Unit } from "@/lib/types";
import {
  AddHuurderDialog,
  ArchiefHuurderActies,
  HuurderKaart,
} from "./huurder-forms";

export const metadata = { title: "Huurders" };

export default async function HuurdersPage({
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
  const { data: huurders } = unitIds.length
    ? await supabase
        .from("huurder")
        .select("*")
        .in("unit_id", unitIds)
        .order("ingang_datum", { ascending: false })
        .returns<Huurder[]>()
    : { data: [] as Huurder[] };

  const lijst = huurders ?? [];
  const actief = lijst.filter((h) => isActiefHuurder(h));
  const gearchiveerd = lijst.filter((h) => !isActiefHuurder(h));
  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));
  const naam = (h: Huurder) => [h.voornaam, h.naam].filter(Boolean).join(" ");

  if (toonArchief)
    return (
      <div className="space-y-5">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Archief huurders ({gearchiveerd.length})</CardTitle>
              <CardDescription>
                Vertrokken huurders blijven raadpleegbaar voor de historiek.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/vme/huurders">Actieve huurders</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {gearchiveerd.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen gearchiveerde huurders.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Huurder</TableHead>
                      <TableHead>Kavel</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>IBAN</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gearchiveerd.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{naam(h)}</TableCell>
                        <TableCell>{unitNaam.get(h.unit_id) ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {h.ingang_datum ? datum(h.ingang_datum) : "?"} –{" "}
                          {h.uitgang_datum ? datum(h.uitgang_datum) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.email ?? "—"}
                          <br />
                          {h.telefoon ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {h.iban ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <ArchiefHuurderActies huurder={h} />
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

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Huurders ({actief.length})</CardTitle>
            <CardDescription>
              Per kavel de actieve huurder met zijn gegevens. De start- en
              einddatum van de huur bepalen de pro-rata afrekening bij vertrek.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/vme/huurders?archief=1">
                Archief huurders ({gearchiveerd.length})
              </Link>
            </Button>
            {units && units.length > 0 && <AddHuurderDialog units={units} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Maak eerst kavels aan bij Structuur.
            </p>
          ) : (
            units.map((u) => {
              const huurdersVanUnit = actief.filter((h) => h.unit_id === u.id);
              if (huurdersVanUnit.length === 0) return null;
              return (
                <section key={u.id} className="space-y-2">
                  <h3 className="text-sm font-semibold">{u.naam}</h3>
                  {huurdersVanUnit.map((h) => (
                    <HuurderKaart key={h.id} huurder={h} units={units} />
                  ))}
                </section>
              );
            })
          )}
          {actief.length === 0 && units && units.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Geen actieve huurders.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
