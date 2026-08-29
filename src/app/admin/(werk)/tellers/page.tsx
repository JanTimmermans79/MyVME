import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { datum, euro } from "@/lib/format";
import { tellerOverzicht } from "@/lib/verbruik";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
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
import type { Eenheidsprijs, Huurder, Meterstand, Teller, Unit } from "@/lib/types";
import { verwijderMeterstand } from "./actions";
import {
  EenheidsprijsForm,
  MaakTellersButton,
  MeternummerRij,
  NieuweMeterstandDialog,
} from "./tellers-client";

export const metadata = { title: "Tellers & verbruik" };

const m3 = (n: number) =>
  `${n.toLocaleString("nl-BE", { maximumFractionDigits: 1 })} m³`;

export default async function TellersPage() {
  const { vme: active, boekjaar } = await getActiveContext();
  if (!active || !boekjaar) return <NoBoekjaar />;
  const gekozenId = boekjaar.id;

  const supabase = await createClient();

  const { data: prijs } = await supabase
    .from("eenheidsprijs")
    .select("*")
    .eq("vme_id", active.id)
    .eq("boekjaar_id", gekozenId)
    .maybeSingle<Eenheidsprijs>();

  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .eq("vme_id", active.id)
    .order("naam")
    .returns<Unit[]>();
  const unitIds = (units ?? []).map((u) => u.id);

  const [{ data: tellers }, { data: huurders }] = await Promise.all([
    unitIds.length
      ? supabase.from("teller").select("*").in("unit_id", unitIds).returns<Teller[]>()
      : Promise.resolve({ data: [] as Teller[] }),
    unitIds.length
      ? supabase.from("huurder").select("*").in("unit_id", unitIds).returns<Huurder[]>()
      : Promise.resolve({ data: [] as Huurder[] }),
  ]);

  const tellerIds = (tellers ?? []).map((t) => t.id);
  const { data: standen } = tellerIds.length
    ? await supabase
        .from("meterstand")
        .select("*")
        .in("teller_id", tellerIds)
        .order("datum", { ascending: false })
        .returns<Meterstand[]>()
    : { data: [] as Meterstand[] };

  const overzicht = await tellerOverzicht(createAdminClient(), active.id, boekjaar);

  const tellersByUnit = new Map<string, Teller[]>();
  for (const t of tellers ?? []) {
    const l = tellersByUnit.get(t.unit_id) ?? [];
    l.push(t);
    tellersByUnit.set(t.unit_id, l);
  }
  const standenByTeller = new Map<string, Meterstand[]>();
  for (const s of standen ?? []) {
    const l = standenByTeller.get(s.teller_id) ?? [];
    l.push(s);
    standenByTeller.set(s.teller_id, l);
  }
  const huurdersByUnit = new Map<string, Huurder[]>();
  for (const h of huurders ?? []) {
    const l = huurdersByUnit.get(h.unit_id) ?? [];
    l.push(h);
    huurdersByUnit.set(h.unit_id, l);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tellers &amp; verbruik</h1>
        <p className="text-sm text-muted-foreground">
          Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}.
          Meterstanden geef je binnen dit boekjaar in; de beginstand komt
          automatisch uit het vorige boekjaar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eenheidsprijzen</CardTitle>
          <CardDescription>
            Per boekjaar. Water geldt voor koud én warm water. Stookolie ={" "}
            (Δ CV × liter/m³ + Δ warm water × liter/m³) × mazoutprijs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EenheidsprijsForm
            vmeId={active.id}
            boekjaarId={gekozenId}
            huidig={prijs ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verbruik &amp; tussentijdse controle</CardTitle>
          <CardDescription>
            Begin → eind → verbruik per teller voor dit boekjaar. Bij een
            tussentijdse stand wordt het jaarverbruik geëxtrapoleerd en vergeleken
            met het jaarvoorschot van de huurder (individueel verbruik; het
            voorschot dekt ook de gedeelde kosten).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {overzicht.length === 0 ? (
            <p className="text-sm text-muted-foreground">Maak eerst units aan.</p>
          ) : (
            overzicht.map((u) => (
              <div key={u.unit_id} className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {u.unit_naam}
                    {u.huurder && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {u.huurder}
                      </span>
                    )}
                  </span>
                  <span className="text-sm">
                    Verbruikskost:{" "}
                    <strong className="tabular-nums">{euro(u.totaalKost)}</strong>
                  </span>
                </div>
                <div className="overflow-x-auto">
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
                      {u.regels.map((r) => (
                        <TableRow key={r.type}>
                          <TableCell>{r.label}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.beginWaarde != null
                              ? `${r.beginWaarde} (${datum(r.beginDatum)})`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.eindWaarde != null
                              ? `${r.eindWaarde} (${datum(r.eindDatum)})`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m3(r.delta)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {euro(r.kost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {u.geraamdeJaarkost != null && u.voorschotJaar > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Geraamd jaarverbruik (o.b.v. meting {datum(u.laatsteMeting)}):
                    </span>
                    <strong className="tabular-nums">
                      {euro(u.geraamdeJaarkost)}
                    </strong>
                    <span className="text-muted-foreground">
                      · jaarvoorschot {euro(u.voorschotJaar)}
                    </span>
                    <Badge
                      variant={
                        u.geraamdeJaarkost > u.voorschotJaar
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {u.geraamdeJaarkost > u.voorschotJaar
                        ? "verbruik hoger dan voorschot"
                        : "voorschot dekt verbruik"}
                    </Badge>
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meterstanden invoeren</CardTitle>
          <CardDescription>
            Meternummers en het invoeren van standen (eindstand, huurderwissel of
            tussentijds). Alleen data binnen het gekozen boekjaar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Maak eerst units aan.</p>
          ) : (
            units.map((u) => {
              const ut = tellersByUnit.get(u.id) ?? [];
              return (
                <div key={u.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{u.naam}</span>
                    {ut.length === 0 ? (
                      <MaakTellersButton unitId={u.id} />
                    ) : (
                      <NieuweMeterstandDialog
                        unitId={u.id}
                        unitNaam={u.naam}
                        tellers={ut}
                        huurders={huurdersByUnit.get(u.id) ?? []}
                        boekjaarStart={boekjaar.start_datum}
                        boekjaarEind={boekjaar.eind_datum}
                      />
                    )}
                  </div>
                  {ut.length > 0 && (
                    <div className="space-y-3">
                      {ut
                        .slice()
                        .sort((a, b) => a.type.localeCompare(b.type))
                        .map((t) => {
                          const st = standenByTeller.get(t.id) ?? [];
                          return (
                            <div key={t.id}>
                              <MeternummerRij teller={t} />
                              {st.length > 0 && (
                                <ul className="ml-32 mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {st.slice(0, 5).map((s) => (
                                    <li
                                      key={s.id}
                                      className="flex items-center gap-2"
                                    >
                                      {datum(s.datum)}: {Number(s.waarde)} m³ (
                                      {s.aanleiding})
                                      <ActionForm
                                        action={verwijderMeterstand}
                                        hiddenFields={{ id: s.id }}
                                      >
                                        <ConfirmSubmit
                                          size="sm"
                                          variant="ghost"
                                          message="Meterstand verwijderen?"
                                        >
                                          ✕
                                        </ConfirmSubmit>
                                      </ActionForm>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
