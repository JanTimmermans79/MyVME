import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoVme } from "@/components/no-vme";
import { TerugLink } from "@/components/terug-link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AV_STATUS_LABEL,
  AV_TYPE_LABEL,
  type AvVergadering,
} from "@/lib/types";
import { CreateAvForm } from "./av-forms";

export const metadata = { title: "Algemene Vergadering" };

export default async function AvPage() {
  const { vme, boekjaar, boekjaren } = await getActiveContext();
  if (!vme) return <NoVme />;

  const supabase = await createClient();
  const [{ data: avRows, error }, { data: puntRows }] = await Promise.all([
    supabase
      .from("av_vergadering")
      .select("*")
      .eq("vme_id", vme.id)
      .order("datum", { ascending: false })
      .returns<AvVergadering[]>(),
    supabase.from("av_agendapunt").select("av_id").eq("vme_id", vme.id),
  ]);

  const migratieNodig =
    error?.message?.toLowerCase().includes("av_vergadering") ?? false;
  const avs = avRows ?? [];
  const puntenPerAv = new Map<string, number>();
  for (const p of (puntRows ?? []) as { av_id: string }[])
    puntenPerAv.set(p.av_id, (puntenPerAv.get(p.av_id) ?? 0) + 1);

  return (
    <div className="space-y-5">
      <TerugLink href="/admin/dashboard">Dashboard</TerugLink>

      <div>
        <h1 className="text-xl font-semibold">Algemene Vergadering</h1>
        <p className="text-sm text-muted-foreground">
          Vergaderingen, agenda &amp; beslissingen en aanwezigheden van {vme.naam}.
        </p>
      </div>

      {migratieNodig && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          De AV-tabellen bestaan nog niet. Draai migratie{" "}
          <code>20260902110000_av_module.sql</code> (en{" "}
          <code>20260902100000_unit_quotiteit.sql</code>) in de Supabase SQL
          Editor.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AV toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateAvForm
            vmeId={vme.id}
            boekjaren={boekjaren}
            boekjaarId={boekjaar?.id}
          />
        </CardContent>
      </Card>

      {avs.length === 0 && !migratieNodig ? (
        <p className="text-sm text-muted-foreground">Nog geen vergaderingen.</p>
      ) : (
        <div className="space-y-2">
          {avs.map((av) => (
            <Link
              key={av.id}
              href={`/admin/av/${av.id}`}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary"
            >
              <span className="font-medium tabular-nums">{datum(av.datum)}</span>
              <Badge variant="outline">{AV_TYPE_LABEL[av.type]}</Badge>
              <Badge
                variant={
                  av.status === "gehouden"
                    ? "secondary"
                    : av.status === "geannuleerd"
                      ? "destructive"
                      : "outline"
                }
              >
                {AV_STATUS_LABEL[av.status]}
              </Badge>
              {av.locatie && (
                <span className="text-sm text-muted-foreground">
                  {av.locatie}
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {puntenPerAv.get(av.id) ?? 0} agendapunt(en)
              </span>
              <ArrowRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
