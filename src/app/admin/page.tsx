import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Boekjaar } from "@/lib/types";

export const metadata = { title: "Overzicht" };

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  vmeId: string,
  column = "vme_id",
) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, vmeId);
  return count ?? 0;
}

export default async function AdminOverview() {
  const { active } = await getActiveVme();
  const supabase = await createClient();

  if (!active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welkom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Er is nog geen VME. Maak er eerst één aan.</p>
          <Link href="/admin/vme" className="underline">
            Naar VME-beheer
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { data: unitRows } = await supabase
    .from("unit")
    .select("id")
    .eq("vme_id", active.id);
  const unitIds = (unitRows ?? []).map((u: { id: string }) => u.id);

  const [units, sleutels, kostenBevestigd, eigenaars] = await Promise.all([
    Promise.resolve(unitIds.length),
    count(supabase, "verdeelsleutel", active.id),
    supabase
      .from("kosten")
      .select("bedrag")
      .eq("vme_id", active.id)
      .eq("status", "bevestigd"),
    unitIds.length
      ? supabase
          .from("eigenaar")
          .select("id", { count: "exact", head: true })
          .in("unit_id", unitIds)
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);

  const kostenTotaal = (kostenBevestigd.data ?? []).reduce(
    (sum: number, k: { bedrag: number }) => sum + Number(k.bedrag),
    0,
  );

  const { data: boekjaren } = await supabase
    .from("boekjaar")
    .select("*")
    .eq("vme_id", active.id)
    .order("start_datum", { ascending: false })
    .returns<Boekjaar[]>();

  const openBoekjaar = (boekjaren ?? []).find((b) => b.status === "open");

  const teControleren = await supabase
    .from("transactie")
    .select("id", { count: "exact", head: true })
    .eq("vme_id", active.id)
    .eq("match_type", "onbevestigd");

  const stats = [
    { label: "Units", value: units, href: "/admin/units" },
    { label: "Eigenaars", value: eigenaars, href: "/admin/eigenaars" },
    { label: "Verdeelsleutels", value: sleutels, href: "/admin/verdeelsleutels" },
    {
      label: "Bevestigde kosten",
      value: euro(kostenTotaal),
      href: "/admin/kosten",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Boekjaar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {openBoekjaar ? (
              <p>
                Open boekjaar:{" "}
                <strong>
                  {datum(openBoekjaar.start_datum)} –{" "}
                  {datum(openBoekjaar.eind_datum)}
                </strong>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Geen open boekjaar.{" "}
                <Link href="/admin/boekjaren" className="underline">
                  Aanmaken
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bankimport</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {teControleren?.count ? (
              <p>
                <strong>{teControleren.count}</strong> transactie(s) te
                controleren.{" "}
                <Link href="/admin/bank" className="underline">
                  Bekijken
                </Link>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Geen openstaande transacties.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
