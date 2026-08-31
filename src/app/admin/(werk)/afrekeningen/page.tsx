import Link from "next/link";
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

    eigenaarRijen = (afrekeningen ?? [])
      .filter((a) => a.betaler_type === "eigenaar")
      .map((a): AfrekeningRij => {
        const e = eigenaarByUnit.get(a.unit_id);
        return {
          id: a.id,
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
        };
      })
      .sort((x, y) => x.unit_naam.localeCompare(y.unit_naam));

    for (const a of afrekeningen ?? [])
      if (a.betaler_type === "huurder" && a.huurder_id)
        opgeslagenHuurder.set(a.huurder_id, a);

    // Live berekening voor het overzicht (altijd actueel).
    const adminDb = createAdminClient();
    huurderResultaten = (
      await berekenHuurderAfrekeningen(adminDb, boekjaar.id)
    ).filter((h) => h.actief);
  }

  return (
    <div className="space-y-6">
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

      {boekjaar && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Huurders ({huurderResultaten.length})</CardTitle>
              <CardDescription>
                Live berekend. Klik op een huurder voor het detail. Bewaren +
                mailen doe je via “(her)berekenen”.
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
                        <TableHead>Huurder</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead className="text-right">Kosten</TableHead>
                        <TableHead className="text-right">Betaald</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {huurderResultaten.map((h) => {
                        const r = saldoRichting(h.saldo);
                        const opgeslagen = opgeslagenHuurder.get(h.huurder_id);
                        return (
                          <TableRow key={h.huurder_id}>
                            <TableCell className="font-medium">
                              {h.huurder_naam}
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
                            <TableCell>{h.unit_naam}</TableCell>
                            <TableCell className="text-xs">
                              {datum(h.periode_start)} – {datum(h.periode_eind)}
                            </TableCell>
                            <TableCell className="text-right">
                              {euro(h.totaal_kosten)}
                            </TableCell>
                            <TableCell className="text-right">
                              {euro(h.voorschot_ontvangen)}
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
                              <Link
                                href={`/admin/afrekeningen/huurder/${h.huurder_id}?boekjaar=${boekjaar.id}`}
                                className="underline"
                              >
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
                Opgeslagen bij de laatste berekening.
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
