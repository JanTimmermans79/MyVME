import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  AV_MEERDERHEID_LABEL,
  AV_STATUS_LABEL,
  AV_TYPE_LABEL,
  type AvAanwezigheid,
  type AvAgendapunt,
  type AvVergadering,
  type Eigenaar,
  type Unit,
} from "@/lib/types";
import { beoordeelMeerderheid, totaleQuotiteit } from "@/lib/av";
import {
  AanwezigheidRij,
  AgendapuntActiepuntKnop,
  CreateAgendapuntForm,
  EditAgendapuntDialog,
  EditAvDialog,
  SetAvStatusKnop,
} from "../av-forms";

export const metadata = { title: "AV" };

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")} %`;

export default async function AvDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { vme, boekjaren } = await getActiveContext();
  if (!vme) return <NoVme />;

  const db = createAdminClient();
  const supabase = await createClient();

  const { data: av } = await db
    .from("av_vergadering")
    .select("*")
    .eq("id", id)
    .eq("vme_id", vme.id)
    .maybeSingle<AvVergadering>();
  if (!av) notFound();

  const [
    { data: puntRows },
    { data: aanwRows },
    { data: unitRows },
    { data: eigRows },
    { data: docRows },
  ] = await Promise.all([
    db
      .from("av_agendapunt")
      .select("*")
      .eq("av_id", id)
      .order("volgnr", { ascending: true })
      .returns<AvAgendapunt[]>(),
    db
      .from("av_aanwezigheid")
      .select("*")
      .eq("av_id", id)
      .returns<AvAanwezigheid[]>(),
    db
      .from("unit")
      .select("*")
      .eq("vme_id", vme.id)
      .order("naam")
      .returns<Unit[]>(),
    db.from("eigenaar").select("*").returns<Eigenaar[]>(),
    supabase
      .from("document")
      .select("id, naam")
      .eq("vme_id", vme.id)
      .order("created_at", { ascending: false }),
  ]);

  const punten = puntRows ?? [];
  const units = unitRows ?? [];
  const aanwezigheden = aanwRows ?? [];
  const documenten = (docRows ?? []) as { id: string; naam: string }[];

  const eigenaarNaam = new Map<string, string>();
  for (const e of (eigRows ?? []) as Eigenaar[]) {
    const naam = [e.voornaam, e.naam].filter(Boolean).join(" ");
    eigenaarNaam.set(
      e.unit_id,
      eigenaarNaam.has(e.unit_id)
        ? `${eigenaarNaam.get(e.unit_id)}, ${naam}`
        : naam,
    );
  }
  const aanwVoorUnit = new Map(aanwezigheden.map((a) => [a.unit_id, a]));

  const { totaal, perUnitGewicht, opBasisVanAantal } = totaleQuotiteit(units);
  const aanwezigGewicht = units.reduce((s, u) => {
    const a = aanwVoorUnit.get(u.id)?.aanwezigheid ?? "afwezig";
    return a === "aanwezig" || a === "volmacht"
      ? s + perUnitGewicht(u.quotiteit)
      : s;
  }, 0);
  const aanwezigAandeel = totaal > 0 ? aanwezigGewicht / totaal : 0;
  const quorum = aanwezigAandeel > 0.5;

  const notulen = documenten.find((d) => d.id === av.notulen_document_id);

  return (
    <div className="space-y-5">
      <TerugLink href="/admin/av">Alle vergaderingen</TerugLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {AV_TYPE_LABEL[av.type]} — {datum(av.datum)}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
            {av.locatie && <span>{av.locatie}</span>}
            {notulen && <span>· 📎 notulen: {notulen.naam}</span>}
          </p>
          {av.omschrijving && (
            <p className="mt-1 text-sm">{av.omschrijving}</p>
          )}
        </div>
        <EditAvDialog av={av} boekjaren={boekjaren} documenten={documenten} />
      </div>

      <SetAvStatusKnop id={av.id} status={av.status} />

      {/* Aanwezigheden */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aanwezigheden</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aanwezig incl. volmacht:{" "}
            <strong className="text-foreground tabular-nums">
              {opBasisVanAantal
                ? `${aanwezigGewicht} / ${totaal} appartementen`
                : `${aanwezigGewicht.toLocaleString("nl-BE")} / ${totaal.toLocaleString("nl-BE")} quotiteiten`}
            </strong>{" "}
            ({pct(aanwezigAandeel)}) ·{" "}
            <span className={quorum ? "text-emerald-600" : "text-destructive"}>
              quorum {quorum ? "gehaald" : "niet gehaald"}
            </span>
            {opBasisVanAantal && (
              <> · geen quotiteiten ingevuld — elk appartement telt voor 1</>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-1 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="w-40">Appartement</span>
            <span className="w-40">Eigenaar</span>
            <span className="w-16 text-right">Quot.</span>
          </div>
          {units.map((u) => {
            const a = aanwVoorUnit.get(u.id);
            return (
              <AanwezigheidRij
                key={u.id}
                avId={av.id}
                vmeId={vme.id}
                unitId={u.id}
                unitNaam={u.naam}
                eigenaar={eigenaarNaam.get(u.id) ?? null}
                quotiteit={u.quotiteit}
                huidige={a?.aanwezigheid ?? "afwezig"}
                volmachtNaam={a?.volmacht_naam ?? null}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Agenda */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Agenda &amp; beslissingen ({punten.length})
        </h2>
        {punten.map((p) => {
          const voor = Number(p.stemmen_voor ?? 0);
          const tegen = Number(p.stemmen_tegen ?? 0);
          const r = beoordeelMeerderheid(p.meerderheid, voor, tegen);
          const heeftStemmen =
            p.stemmen_voor != null || p.stemmen_tegen != null;
          const uitkomst =
            p.aangenomen ?? (heeftStemmen ? r.gehaald : null);
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    {p.volgnr}. {p.titel}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {AV_MEERDERHEID_LABEL[p.meerderheid]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <AgendapuntActiepuntKnop punt={p} />
                  <EditAgendapuntDialog punt={p} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.toelichting && (
                  <p className="text-muted-foreground">{p.toelichting}</p>
                )}
                {p.meerderheid !== "informatief" && (
                  <div className="flex flex-wrap items-center gap-3 tabular-nums">
                    <span>voor {voor.toLocaleString("nl-BE")}</span>
                    <span>tegen {tegen.toLocaleString("nl-BE")}</span>
                    <span className="text-muted-foreground">
                      onthouding{" "}
                      {Number(p.stemmen_onthouding ?? 0).toLocaleString("nl-BE")}
                    </span>
                    {heeftStemmen && (
                      <span className="text-muted-foreground">
                        · {r.omschrijving}
                      </span>
                    )}
                  </div>
                )}
                {uitkomst != null && (
                  <Badge variant={uitkomst ? "secondary" : "destructive"}>
                    {uitkomst ? "Aangenomen" : "Niet aangenomen"}
                  </Badge>
                )}
                {p.beslissing && (
                  <p className="rounded-md bg-muted/50 p-2">{p.beslissing}</p>
                )}
                {p.actiepunt_id && (
                  <p className="text-xs text-muted-foreground">
                    → gekoppeld aan een actiepunt
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agendapunt toevoegen</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateAgendapuntForm avId={av.id} vmeId={vme.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
