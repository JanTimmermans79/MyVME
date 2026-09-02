import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { datum, euro } from "@/lib/format";
import { tellerOverzicht } from "@/lib/verbruik";
import { MeterfotoUpload } from "@/components/meterfoto-upload";
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
import {
  METEROPNAME_STATUS_LABEL,
  type Afrekening,
  type AfrekeningLijn,
  type Eigenaar,
  type Huurder,
  type Meteropname,
  type Teller,
  type Unit,
} from "@/lib/types";

export const metadata = { title: "Meterstanden" };

const vandaag = () => new Date().toISOString().slice(0, 10);

export default async function EigenaarMeterstandenPage() {
  await requireUser();
  const supabase = await createClient();
  const { vme, boekjaar } = await getActiveContext();

  const { data: eigenaars } = await supabase
    .from("eigenaar")
    .select("*")
    .returns<Eigenaar[]>();

  if (!vme || !eigenaars || eigenaars.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nog niet gekoppeld</CardTitle>
          <CardDescription>
            Je account is nog niet aan een wooneenheid gekoppeld. Neem contact op
            met de syndicus.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .eq("vme_id", vme.id)
    .returns<Unit[]>();
  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const mijnUnitIds = [
    ...new Set(
      eigenaars.map((e) => e.unit_id).filter((id) => unitById.has(id)),
    ),
  ];

  if (mijnUnitIds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geen appartement in deze VME</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const [
    { data: tellers },
    { data: opnameRows, error: opnameErr },
    { data: huurders },
  ] = await Promise.all([
    supabase.from("teller").select("*").in("unit_id", mijnUnitIds).returns<Teller[]>(),
    supabase
      .from("meteropname")
      .select("*")
      .in("unit_id", mijnUnitIds)
      .order("created_at", { ascending: false })
      .returns<Meteropname[]>(),
    supabase.from("huurder").select("*").in("unit_id", mijnUnitIds).returns<Huurder[]>(),
  ]);
  const opnameMigratieNodig =
    opnameErr?.message?.toLowerCase().includes("meteropname") ?? false;

  const overzicht = boekjaar
    ? await tellerOverzicht(createAdminClient(), vme.id, boekjaar)
    : [];

  let afrekeningen: Afrekening[] = [];
  let lijnen: AfrekeningLijn[] = [];
  if (boekjaar) {
    const { data: afr } = await supabase
      .from("afrekening")
      .select("*")
      .eq("boekjaar_id", boekjaar.id)
      .in("unit_id", mijnUnitIds)
      .returns<Afrekening[]>();
    afrekeningen = afr ?? [];
    if (afrekeningen.length) {
      const { data: lj } = await supabase
        .from("afrekening_lijn")
        .select("*")
        .in(
          "afrekening_id",
          afrekeningen.map((a) => a.id),
        )
        .returns<AfrekeningLijn[]>();
      lijnen = lj ?? [];
    }
  }

  const tellersByUnit = new Map<string, Teller[]>();
  for (const t of tellers ?? []) {
    const l = tellersByUnit.get(t.unit_id) ?? [];
    l.push(t);
    tellersByUnit.set(t.unit_id, l);
  }
  const nu = vandaag();
  const actieveHuurderVoor = (unitId: string) =>
    (huurders ?? []).find(
      (h) =>
        h.unit_id === unitId &&
        (h.ingang_datum ?? "0000-01-01") <= nu &&
        (h.uitgang_datum ?? "9999-12-31") >= nu,
    ) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Meterstanden</h1>
        <p className="text-sm text-muted-foreground">
          {boekjaar
            ? `Boekjaar ${datum(boekjaar.start_datum)} – ${datum(
                boekjaar.eind_datum,
              )}.`
            : "Kies een boekjaar in de balk bovenaan."}{" "}
          Neem een foto van je teller; de syndicus bevestigt je opname.
        </p>
      </div>

      {opnameMigratieNodig && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          De foto-opnamefunctie is nog niet geactiveerd. Neem contact op met de
          syndicus.
        </div>
      )}

      {mijnUnitIds.map((unitId) => {
        const unit = unitById.get(unitId)!;
        const ut = tellersByUnit.get(unitId) ?? [];
        const mijnOpnames = (opnameRows ?? []).filter(
          (o) => o.unit_id === unitId,
        );
        const verbruik = overzicht.find((u) => u.unit_id === unitId) ?? null;
        const huurder = actieveHuurderVoor(unitId);
        const afr = afrekeningen.filter((a) => a.unit_id === unitId);

        return (
          <Card key={unitId}>
            <CardHeader>
              <CardTitle>{unit.naam}</CardTitle>
              {huurder && (
                <CardDescription>
                  Er woont een huurder in dit appartement — het verbruik wordt
                  met de huurder afgerekend, niet met jou.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tellers */}
              <section>
                <h3 className="mb-2 text-sm font-medium">Je tellers</h3>
                {ut.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog geen tellers geregistreerd. Vraag de syndicus ze aan te
                    maken.
                  </p>
                ) : (
                  <ul className="text-sm text-muted-foreground">
                    {ut
                      .slice()
                      .sort((a, b) => a.type.localeCompare(b.type))
                      .map((t) => (
                        <li key={t.id}>
                          {TYPE_LABEL[t.type] ?? t.type}
                          {t.meternummer ? ` — nr. ${t.meternummer}` : ""}
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              {/* Foto indienen */}
              {!opnameMigratieNodig && ut.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Foto indienen</h3>
                  <MeterfotoUpload
                    rol="eigenaar"
                    vmeId={vme.id}
                    unitId={unitId}
                    unitNaam={unit.naam}
                    boekjaarId={boekjaar?.id}
                    tellers={ut.map((t) => ({
                      id: t.id,
                      type: t.type,
                      meternummer: t.meternummer,
                    }))}
                  />
                </section>
              )}

              {/* Mijn opnames */}
              {mijnOpnames.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Mijn opnames</h3>
                  <ul className="space-y-1 text-sm">
                    {mijnOpnames.map((o) => (
                      <li
                        key={o.id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="tabular-nums">
                          {o.opname_datum ? datum(o.opname_datum) : "—"}
                        </span>
                        <span className="text-muted-foreground">
                          {o.waarde ?? o.herkende_waarde ?? "?"} m³
                        </span>
                        <Badge
                          variant={
                            o.status === "verwerkt"
                              ? "secondary"
                              : o.status === "afgewezen"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {METEROPNAME_STATUS_LABEL[o.status]}
                        </Badge>
                        {o.status === "afgewezen" && o.opmerking && (
                          <span className="text-xs text-muted-foreground">
                            {o.opmerking}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Verbruik dit boekjaar */}
              {verbruik && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">
                    Verbruik dit boekjaar
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teller</TableHead>
                        <TableHead className="text-right">Begin</TableHead>
                        <TableHead className="text-right">Eind</TableHead>
                        <TableHead className="text-right">Verbruik</TableHead>
                        <TableHead className="text-right">Kost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verbruik.regels.map((r) => (
                        <TableRow key={r.type}>
                          <TableCell>{r.label}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.beginWaarde != null ? `${r.beginWaarde} m³` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.eindWaarde != null ? `${r.eindWaarde} m³` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.delta.toLocaleString("nl-BE", {
                              maximumFractionDigits: 1,
                            })}{" "}
                            m³
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {euro(r.kost)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} className="font-medium">
                          Totaal verbruikskost
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {euro(verbruik.totaalKost)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </section>
              )}

              {/* Afrekening */}
              {afr.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Afrekening</h3>
                  {afr.map((a) => {
                    const aLijnen = lijnen.filter(
                      (l) => l.afrekening_id === a.id,
                    );
                    return (
                      <div key={a.id} className="space-y-2">
                        <p className="text-sm">
                          <span className="capitalize">{a.betaler_type}</span> ·
                          verschuldigd {euro(a.verschuldigd)} · ontvangen{" "}
                          {euro(a.ontvangen)} ·{" "}
                          <Badge
                            variant={
                              Number(a.saldo) > 0 ? "destructive" : "secondary"
                            }
                          >
                            saldo {euro(a.saldo)}
                          </Badge>
                        </p>
                        {aLijnen.length > 0 && (
                          <Table>
                            <TableBody>
                              {aLijnen.map((l) => (
                                <TableRow key={l.id}>
                                  <TableCell>{l.omschrijving}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {euro(l.bedrag)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  koud_water: "Koud water",
  warm_water: "Warm water",
  cv: "CV / verwarming",
};
