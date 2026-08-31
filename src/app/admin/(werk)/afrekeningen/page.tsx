import Link from "next/link";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { datum, euro, saldoRichting } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
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
import type { Afrekening, Eigenaar, Unit } from "@/lib/types";
import { berekenHuurderAfrekeningen } from "@/lib/huurder-afrekening";
import { berekenEigenaarAfrekeningen } from "@/lib/afrekening";
import { berekenEnBewaar } from "./actions";
import { AfrekeningTabel, type AfrekeningRij } from "./afrekening-client";

export const metadata = { title: "Afrekeningen" };

export default async function AfrekeningenPage() {
  const { vme: active, boekjaar } = await getActiveContext();
  if (!active || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();

  let eigenaarRijen: AfrekeningRij[] = [];
  let huurderResultaten: Awaited<
    ReturnType<typeof berekenHuurderAfrekeningen>
  > = [];
  const opgeslagenHuurder = new Map<string, Afrekening>();

  if (boekjaar) {
    const { data: units } = await supabase
      .from("unit")
      .select("*")
      .eq("vme_id", active.id)
      .returns<Unit[]>();
    const unitIds = (units ?? []).map((u) => u.id);
    const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));

    const [{ data: afrekeningen }, { data: eigenaars }] = await Promise.all([
      supabase
        .from("afrekening")
        .select("*")
        .eq("boekjaar_id", boekjaar.id)
        .returns<Afrekening[]>(),
      unitIds.length
        ? supabase
            .from("eigenaar")
            .select("*")
            .in("unit_id", unitIds)
            .returns<Eigenaar[]>()
        : Promise.resolve({ data: [] as Eigenaar[] }),
    ]);

    const eigenaarByUnit = new Map<string, Eigenaar>();
    for (const e of eigenaars ?? [])
      if (!eigenaarByUnit.has(e.unit_id)) eigenaarByUnit.set(e.unit_id, e);

    // Reservefonds-/kapitaalcijfers uit de live berekening.
    const { regels: eigLive } = await berekenEigenaarAfrekeningen(
      createAdminClient(),
      boekjaar.id,
    );
    const liveByUnit = new Map(eigLive.map((r) => [r.unit_id, r]));

    eigenaarRijen = (afrekeningen ?? [])
      .filter((a) => a.betaler_type === "eigenaar")
      .map((a): AfrekeningRij => {
        const e = eigenaarByUnit.get(a.unit_id);
        const live = liveByUnit.get(a.unit_id);
        return {
          id: a.id,
          unit_id: a.unit_id,
          unit_naam: unitNaam.get(a.unit_id) ?? "—",
          betaler_type: "eigenaar",
          verschuldigd: Number(a.verschuldigd),
          ontvangen: Number(a.ontvangen),
          saldo: Number(a.saldo),
          ontvanger_naam: e
            ? [e.voornaam, e.naam].filter(Boolean).join(" ")
            : "onbekend",
          ontvanger_email: e?.email ?? null,
          mail_verzonden_op: a.mail_verzonden_op,
          mail_status: a.mail_status,
          reservefonds_ontvangen: live?.reservefonds_ontvangen ?? 0,
          kapitaalopvraging: live?.kapitaalopvraging ?? 0,
        };
      })
      .sort((x, y) => x.unit_naam.localeCompare(y.unit_naam));

    for (const a of afrekeningen ?? [])
      if (a.betaler_type === "huurder" && a.huurder_id)
        opgeslagenHuurder.set(a.huurder_id, a);

    // Live berekening voor het overzicht (altijd actueel). Afgehandelde huurders
    // (vertrokken + afrekening verstuurd) onderaan.
    const adminDb = createAdminClient();
    huurderResultaten = (await berekenHuurderAfrekeningen(adminDb, boekjaar.id))
      .filter((h) => h.actief)
      .sort(
        (a, b) =>
          Number(a.afgehandeld) - Number(b.afgehandeld) ||
          a.unit_naam.localeCompare(b.unit_naam) ||
          a.periode_start.localeCompare(b.periode_start),
      );
  }

  const alleWaarschuwingen = huurderResultaten.flatMap((h) =>
    h.waarschuwingen.map((tekst) => ({
      wie: `${h.huurder_naam} — ${h.unit_naam}`,
      tekst,
      href: `/admin/afrekeningen/huurder/${h.huurder_id}?boekjaar=${
        boekjaar?.id ?? ""
      }`,
    })),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Terug naar dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Jaarafrekening</CardTitle>
          <CardDescription>
            Eigenaars: aandeel per kostenpost via de verdeelsleutel. Huurders:
            individueel verbruik via de tellers + pro rata aandeel in de
            gedeelde kosten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Boekjaar {datum(boekjaar.start_datum)} –{" "}
              {datum(boekjaar.eind_datum)}
            </span>
            <ActionForm
              action={berekenEnBewaar}
              hiddenFields={{ boekjaar_id: boekjaar.id }}
            >
              <SubmitButton>Afrekeningen (her)berekenen</SubmitButton>
            </ActionForm>
          </div>
        </CardContent>
      </Card>

      {alleWaarschuwingen.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              Waarschuwingen ({alleWaarschuwingen.length})
            </CardTitle>
            <CardDescription>
              Controleer deze punten vóór je de afrekeningen verstuurt. Klik op
              een naam voor het detail van die huurder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {alleWaarschuwingen.map((w, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={w.href}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {w.wie}
                  </Link>
                  <span className="text-muted-foreground">{w.tekst}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {boekjaar && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Huurders ({huurderResultaten.length}
                {(() => {
                  const n = huurderResultaten.filter((h) => h.afgehandeld).length;
                  return n > 0 ? ` · ${n} afgehandeld` : "";
                })()}
                )
              </CardTitle>
              <CardDescription>
                Live berekend. Klik op een huurder voor het detail. Bewaren +
                mailen doe je via “(her)berekenen”. Vertrokken huurders met een
                verstuurde afrekening staan onderaan als{" "}
                <em>afgehandeld</em>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {huurderResultaten.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Geen huurders met een huurperiode in dit boekjaar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Appartement</TableHead>
                        <TableHead>Huurder</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead className="text-right">Voorschotten</TableHead>
                        <TableHead className="text-right">Verbruik</TableHead>
                        <TableHead className="text-right">Diverse</TableHead>
                        <TableHead className="text-right">Totaal kosten</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {huurderResultaten.map((h) => {
                        const r = saldoRichting(h.saldo);
                        const opgeslagen = opgeslagenHuurder.get(h.huurder_id);
                        const verbruik = h.lijnen
                          .filter((l) => l.soort !== "gedeeld")
                          .reduce((s, l) => s + l.bedrag, 0);
                        const diverse = h.lijnen
                          .filter((l) => l.soort === "gedeeld")
                          .reduce((s, l) => s + l.bedrag, 0);
                        const href = `/admin/afrekeningen/huurder/${h.huurder_id}?boekjaar=${boekjaar.id}`;
                        return (
                          <TableRow
                            key={h.huurder_id}
                            className={h.afgehandeld ? "opacity-55" : undefined}
                          >
                            <TableCell>{h.unit_naam}</TableCell>
                            <TableCell className="font-medium">
                              <Link href={href} className="hover:underline">
                                {h.huurder_naam}
                              </Link>
                              {h.afgehandeld && (
                                <Badge variant="outline" className="ml-2">
                                  afgehandeld
                                </Badge>
                              )}
                              {!h.afgehandeld && h.vertrokken_in_boekjaar && (
                                <Badge variant="secondary" className="ml-2">
                                  vertrokken
                                </Badge>
                              )}
                              {h.waarschuwingen.length > 0 && (
                                <Badge
                                  variant="destructive"
                                  className="ml-2"
                                  title={h.waarschuwingen.join("\n")}
                                >
                                  {h.waarschuwingen.length} ⚠
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {datum(h.periode_start)} – {datum(h.periode_eind)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {euro(h.voorschot_ontvangen)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {euro(verbruik)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {euro(diverse)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {euro(h.totaal_kosten)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  r.bijbetaling ? "destructive" : "secondary"
                                }
                              >
                                {euro(h.saldo)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <Link href={href} className="underline">
                                detail
                              </Link>
                              {opgeslagen?.mail_verzonden_op && (
                                <span className="ml-2 text-muted-foreground">
                                  gemaild {datum(opgeslagen.mail_verzonden_op)}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-medium">
                        <TableCell colSpan={3}>Totaal</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(
                            huurderResultaten.reduce(
                              (s, h) => s + h.voorschot_ontvangen,
                              0,
                            ),
                          )}
                        </TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="text-right tabular-nums">
                          {euro(
                            huurderResultaten.reduce(
                              (s, h) => s + h.totaal_kosten,
                              0,
                            ),
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(
                            huurderResultaten.reduce((s, h) => s + h.saldo, 0),
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eigenaars ({eigenaarRijen.length})</CardTitle>
              <CardDescription>
                Aandeel in de eigenaarskosten (zichtrekening) opgeslagen bij de
                laatste berekening; reservefonds en kapitaalopvragingen zijn
                context. Klik op een appartement voor het detail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eigenaarRijen.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nog geen berekende eigenaarafrekeningen. Klik op
                  “(her)berekenen”.
                </p>
              ) : (
                <AfrekeningTabel
                  rijen={eigenaarRijen}
                  context={{
                    vme_naam: active.naam,
                    vme_iban: active.iban ?? "",
                    boekjaar: `${datum(boekjaar.start_datum)} – ${datum(
                      boekjaar.eind_datum,
                    )}`,
                    boekjaar_id: boekjaar.id,
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
