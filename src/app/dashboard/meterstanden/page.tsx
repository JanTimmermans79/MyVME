import { createClient } from "@/lib/supabase/server";
import { datum, euro } from "@/lib/format";
import { eigenaarOverzicht } from "@/lib/eigenaar-overzicht";
import { MeterfotoUpload, ManueleOpnameDialog } from "@/components/meterfoto-upload";
import { VerbruikGrafiek } from "@/components/verbruik-grafiek";
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
import { METEROPNAME_STATUS_LABEL, type Meteropname } from "@/lib/types";

export const metadata = { title: "Meterstanden" };

const TYPE_LABEL: Record<string, string> = {
  koud_water: "Koud water",
  warm_water: "Warm water",
  cv: "CV / verwarming",
};
const AANLEIDING_LABEL: Record<string, string> = {
  boekjaareinde: "Einde boekjaar",
  einde_huurder: "Einde huurder",
  start_huurder: "Start nieuwe huurder",
  tussentijds: "Tussentijds",
  huurderwissel: "Huurderwissel",
};

export default async function EigenaarMeterstandenPage() {
  const data = await eigenaarOverzicht(true);

  if (data.leeg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {data.leeg === "geen-vme" ? "Geen VME" : "Nog niet gekoppeld"}
          </CardTitle>
          <CardDescription>
            {data.leeg === "geen-vme"
              ? "Er is geen VME beschikbaar voor je account."
              : "Je account is nog niet aan een wooneenheid gekoppeld. Neem contact op met de syndicus."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { vme, boekjaar, units, verbruik5 } = data;
  const mijnUnitIds = units.map((u) => u.unit.id);

  // Foto-/handmatige opnames van de eigenaar (+ migratiedetectie).
  const supabase = await createClient();
  const { data: opnameRows, error: opnameErr } = await supabase
    .from("meteropname")
    .select("*")
    .in("unit_id", mijnUnitIds)
    .order("created_at", { ascending: false })
    .returns<Meteropname[]>();
  const opnameMigratieNodig =
    opnameErr?.message?.toLowerCase().includes("meteropname") ?? false;

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
          Voeg een meterstand toe met een foto of handmatig; de syndicus bevestigt
          ze.
        </p>
      </div>

      {opnameMigratieNodig && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          De functie om zelf meterstanden in te dienen is nog niet geactiveerd.
          Neem contact op met de syndicus.
        </div>
      )}

      {verbruik5 && verbruik5.boekjaren.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verbruik over de jaren</CardTitle>
            <CardDescription>
              Water en stookolie per appartement, per boekjaar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerbruikGrafiek verbruik={verbruik5} />
          </CardContent>
        </Card>
      )}

      {units.map((u) => {
        const opnames = (opnameRows ?? []).filter(
          (o) => o.unit_id === u.unit.id,
        );
        const standenByTeller = new Map<string, typeof u.standen>();
        for (const s of u.standen) {
          const l = standenByTeller.get(s.teller_id) ?? [];
          l.push(s);
          standenByTeller.set(s.teller_id, l);
        }

        return (
          <Card key={u.unit.id}>
            <CardHeader>
              <CardTitle>{u.unit.naam}</CardTitle>
              <CardDescription>
                Huidige huurder:{" "}
                {u.huidigeHuurder
                  ? u.huidigeHuurder.naam
                  : "geen (je bewoont het zelf of het staat leeg)"}
                {u.huidigeHuurder && (
                  <> — het verbruik wordt met de huurder afgerekend, niet met jou.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tellers */}
              <section>
                <h3 className="mb-2 text-sm font-medium">Je tellers</h3>
                {u.tellers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog geen tellers geregistreerd. Vraag de syndicus ze aan te
                    maken.
                  </p>
                ) : (
                  <ul className="text-sm text-muted-foreground">
                    {u.tellers
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

              {/* Meterstand toevoegen */}
              {u.tellers.length > 0 && !opnameMigratieNodig && (
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">Meterstand toevoegen</h3>
                  <MeterfotoUpload
                    rol="eigenaar"
                    vmeId={vme.id}
                    unitId={u.unit.id}
                    unitNaam={u.unit.naam}
                    boekjaarId={boekjaar?.id}
                    tellers={u.tellers}
                  />
                  <ManueleOpnameDialog
                    vmeId={vme.id}
                    unitId={u.unit.id}
                    unitNaam={u.unit.naam}
                    boekjaarId={boekjaar?.id}
                    tellers={u.tellers}
                  />
                </section>
              )}

              {/* Mijn opnames */}
              {opnames.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Mijn opnames</h3>
                  <ul className="space-y-1 text-sm">
                    {opnames.map((o) => (
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

              {/* Meterstanden-historiek */}
              {u.standen.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">
                    Geregistreerde meterstanden
                  </h3>
                  <div className="space-y-3">
                    {u.tellers
                      .slice()
                      .sort((a, b) => a.type.localeCompare(b.type))
                      .map((t) => {
                        const rijen = (standenByTeller.get(t.id) ?? []).slice(
                          0,
                          6,
                        );
                        if (rijen.length === 0) return null;
                        return (
                          <div key={t.id}>
                            <p className="text-xs font-medium text-muted-foreground">
                              {TYPE_LABEL[t.type] ?? t.type}
                            </p>
                            <Table>
                              <TableBody>
                                {rijen.map((s, i) => (
                                  <TableRow key={`${s.datum}-${i}`}>
                                    <TableCell className="py-1 text-xs">
                                      {datum(s.datum)}
                                    </TableCell>
                                    <TableCell className="py-1 text-right text-xs tabular-nums">
                                      {s.waarde} m³
                                    </TableCell>
                                    <TableCell className="py-1 text-xs text-muted-foreground">
                                      {AANLEIDING_LABEL[s.aanleiding] ??
                                        s.aanleiding}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

              {/* Verbruik dit boekjaar */}
              {u.verbruik && (
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
                      {u.verbruik.regels.map((r) => (
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
                          {euro(u.verbruik.totaalKost)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </section>
              )}

              {/* Afrekening */}
              {u.afrekeningen.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Afrekening</h3>
                  {u.afrekeningen.map((a) => {
                    const aLijnen = data.afrekeningLijnen.filter(
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
