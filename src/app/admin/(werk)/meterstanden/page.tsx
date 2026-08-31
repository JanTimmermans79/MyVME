import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { datum, euro } from "@/lib/format";
import { tellerOverzicht } from "@/lib/verbruik";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { TerugLink } from "@/components/terug-link";
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
import type { Eenheidsprijs, Huurder, Teller, Unit } from "@/lib/types";
import {
  EditMeterstandGroep,
  EenheidsprijsForm,
  MaakTellersButton,
  MeternummerRij,
  NieuweMeterstandDialog,
} from "./tellers-client";

export const metadata = { title: "Meterstanden" };

const m3 = (n: number) =>
  `${n.toLocaleString("nl-BE", { maximumFractionDigits: 1 })} m³`;

export default async function TellersPage() {
  const { vme: active, boekjaar } = await getActiveContext();
  if (!active || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();

  const [{ data: prijs }, { data: units }] = await Promise.all([
    supabase
      .from("eenheidsprijs")
      .select("*")
      .eq("vme_id", active.id)
      .eq("boekjaar_id", boekjaar.id)
      .maybeSingle<Eenheidsprijs>(),
    supabase
      .from("unit")
      .select("*")
      .eq("vme_id", active.id)
      .order("naam")
      .returns<Unit[]>(),
  ]);
  const unitIds = (units ?? []).map((u) => u.id);

  const [{ data: tellers }, { data: huurders }] = await Promise.all([
    unitIds.length
      ? supabase.from("teller").select("*").in("unit_id", unitIds).returns<Teller[]>()
      : Promise.resolve({ data: [] as Teller[] }),
    unitIds.length
      ? supabase.from("huurder").select("*").in("unit_id", unitIds).returns<Huurder[]>()
      : Promise.resolve({ data: [] as Huurder[] }),
  ]);

  const overzicht = await tellerOverzicht(createAdminClient(), active.id, boekjaar);

  const tellersByUnit = new Map<string, Teller[]>();
  for (const t of tellers ?? []) {
    const l = tellersByUnit.get(t.unit_id) ?? [];
    l.push(t);
    tellersByUnit.set(t.unit_id, l);
  }
  const huurdersByUnit = new Map<string, Huurder[]>();
  for (const h of huurders ?? []) {
    const l = huurdersByUnit.get(h.unit_id) ?? [];
    l.push(h);
    huurdersByUnit.set(h.unit_id, l);
  }
  const meternrByTeller = new Map((tellers ?? []).map((t) => [`${t.unit_id}|${t.type}`, t]));

  return (
    <div className="space-y-5">
      <TerugLink href="/admin/dashboard">Dashboard</TerugLink>

      <div>
        <h1 className="text-xl font-semibold">Meterstanden</h1>
        <p className="text-sm text-muted-foreground">
          Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}.
          De beginstand is de afrekeningswaarde van het vorige boekjaar. Voer per
          appartement de eindstand in; tussentijdse standen (huurderwissel,
          controle) tellen mee voor het overzicht, niet voor de jaarafrekening.
        </p>
      </div>

      {(units ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Maak eerst appartementen aan via Instellingen.
        </p>
      ) : (
        overzicht.map((u) => {
          const ut = tellersByUnit.get(u.unit_id) ?? [];
          const heeftTellers = ut.length > 0;
          return (
            <Card key={u.unit_id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    {u.unit_naam}
                    {u.huurder && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {u.huurder}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Verbruikskost dit boekjaar:{" "}
                    <strong className="tabular-nums text-foreground">
                      {euro(u.totaalKost)}
                    </strong>
                  </CardDescription>
                </div>
                {heeftTellers ? (
                  <NieuweMeterstandDialog
                    unitId={u.unit_id}
                    unitNaam={u.unit_naam}
                    tellers={ut}
                    huurders={huurdersByUnit.get(u.unit_id) ?? []}
                    boekjaarStart={boekjaar.start_datum}
                    boekjaarEind={boekjaar.eind_datum}
                  />
                ) : (
                  <MaakTellersButton unitId={u.unit_id} />
                )}
              </CardHeader>

              {heeftTellers && (
                <CardContent className="space-y-3">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Teller</TableHead>
                          <TableHead className="text-right">
                            Begin (vorig boekjaar)
                          </TableHead>
                          <TableHead className="text-right">Eind</TableHead>
                          <TableHead className="text-right">Verbruik</TableHead>
                          <TableHead className="text-right">Kost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {u.regels.map((r) => {
                          const teller = meternrByTeller.get(`${u.unit_id}|${r.type}`);
                          return (
                            <TableRow key={r.type}>
                              <TableCell>
                                {r.label}
                                {teller?.meternummer && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    nr. {teller.meternummer}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {r.beginWaarde != null
                                  ? `${r.beginWaarde} m³`
                                  : "—"}
                                {r.beginDatum && (
                                  <span className="block text-muted-foreground">
                                    {datum(r.beginDatum)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {r.eindWaarde != null ? `${r.eindWaarde} m³` : "—"}
                                {r.eindDatum && (
                                  <span className="block text-muted-foreground">
                                    {datum(r.eindDatum)}
                                    {r.eindAanleiding === "tussentijds" && (
                                      <Badge
                                        variant="outline"
                                        className="ml-1 px-1 py-0 text-[10px]"
                                      >
                                        voorlopig
                                      </Badge>
                                    )}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {m3(r.delta)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {euro(r.kost)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Standen van dit boekjaar — klik een rij om aan te passen */}
                  {(() => {
                    const groepen = new Map<
                      string,
                      {
                        datum: string;
                        aanleiding: string;
                        huurderId: string | null;
                        items: { type: string; id: string; waarde: number }[];
                      }
                    >();
                    for (const r of u.regels) {
                      for (const s of r.standenDitBoekjaar) {
                        const key = `${s.datum}|${s.aanleiding}`;
                        const g =
                          groepen.get(key) ??
                          {
                            datum: s.datum,
                            aanleiding: s.aanleiding,
                            huurderId: s.huurder_id,
                            items: [],
                          };
                        g.items.push({ type: r.type, id: s.id, waarde: s.waarde });
                        groepen.set(key, g);
                      }
                    }
                    const lijst = [...groepen.values()].sort((a, b) =>
                      b.datum.localeCompare(a.datum),
                    );
                    if (lijst.length === 0)
                      return (
                        <p className="text-xs text-muted-foreground">
                          Nog geen standen dit boekjaar. Gebruik “Meterstanden”
                          hierboven.
                        </p>
                      );
                    return (
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="mb-1 flex gap-2 px-2 text-[11px] font-medium text-muted-foreground">
                          <span className="w-20">Datum</span>
                          <span className="w-24">Koud</span>
                          <span className="w-24">Warm</span>
                          <span className="w-24">CV</span>
                        </div>
                        {lijst.map((g) => (
                          <EditMeterstandGroep
                            key={`${g.datum}|${g.aanleiding}`}
                            unitNaam={u.unit_naam}
                            datum={g.datum}
                            aanleiding={g.aanleiding}
                            huurderId={g.huurderId}
                            items={g.items}
                            huurders={huurdersByUnit.get(u.unit_id) ?? []}
                            boekjaarStart={boekjaar.start_datum}
                            boekjaarEind={boekjaar.eind_datum}
                          />
                        ))}
                      </div>
                    );
                  })()}

                  {/* Meternummers (compact) */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Meternummers bewerken
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {ut
                        .slice()
                        .sort((a, b) => a.type.localeCompare(b.type))
                        .map((t) => (
                          <MeternummerRij key={t.id} teller={t} />
                        ))}
                    </div>
                  </details>

                  {/* Tussentijdse controle: verbruik op schema? */}
                  {u.geraamdeJaarkost != null && u.voorschotJaar > 0 && (
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Geraamd jaarverbruik (o.b.v. {datum(u.laatsteMeting)}):
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
                          ? "verbruik boven voorschot"
                          : "op schema"}
                      </Badge>
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eenheidsprijzen</CardTitle>
          <CardDescription>
            Per boekjaar. Water geldt voor koud én warm water. Stookolie ={" "}
            (Δ CV × liter/m³ + Δ warm water × liter/m³) × mazoutprijs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EenheidsprijsForm
            vmeId={active.id}
            boekjaarId={boekjaar.id}
            huidig={prijs ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
