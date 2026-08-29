import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calculator,
  FileText,
  Gauge,
  Landmark,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import {
  vmeBoekjaarOverzicht,
  jaarlijkseTotalen,
  gedeeldeKostenPerJaar,
  type RekeningCashflow,
} from "@/lib/vme-dashboard";
import { verbruik5Jaar } from "@/lib/verbruik";
import { voorschotControle } from "@/lib/voorschot-controle";
import { berekenHuurderAfrekeningen } from "@/lib/huurder-afrekening";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { StatCard } from "@/components/stat-card";
import { QuickActions } from "@/components/quick-actions";
import { BarChart } from "@/components/bar-chart";
import { StackedBarChart } from "@/components/stacked-bar-chart";
import { VerbruikOverzicht } from "@/components/verbruik-overzicht";
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

export const metadata = { title: "Dashboard" };

function PostLijst({
  posten,
  totaal,
  totaalLabel,
}: {
  posten: { label: string; bedrag: number }[];
  totaal: number;
  totaalLabel: string;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      {posten.length === 0 ? (
        <p className="text-muted-foreground">Nog niets geboekt.</p>
      ) : (
        posten.map((p) => (
          <div key={p.label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{p.label}</span>
            <span className="tabular-nums">{euro(p.bedrag)}</span>
          </div>
        ))
      )}
      <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
        <span>{totaalLabel}</span>
        <span className="tabular-nums">{euro(totaal)}</span>
      </div>
    </div>
  );
}

function RekeningKaart({
  titel,
  omschrijving,
  cf,
}: {
  titel: string;
  omschrijving: string;
  cf: RekeningCashflow;
}) {
  const saldoBekend = cf.saldoEind != null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="size-4 text-sky-500" /> {titel}
        </CardTitle>
        <CardDescription>{omschrijving}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PostLijst
          posten={cf.inkomsten}
          totaal={cf.totaalIn}
          totaalLabel="Totaal inkomsten"
        />
        <PostLijst
          posten={cf.uitgaven}
          totaal={cf.totaalUit}
          totaalLabel="Totaal uitgaven"
        />
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          {!cf.geuploadet ? (
            <span className="text-amber-600">
              Nog geen uittreksel geüpload voor dit boekjaar.{" "}
              <Link href="/admin/bank" className="underline">
                Uploaden
              </Link>
            </span>
          ) : saldoBekend ? (
            <span className="tabular-nums">
              Saldo {euro(cf.saldoBegin)} →{" "}
              <strong>{euro(cf.saldoEind)}</strong>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Beweging dit boekjaar {euro(cf.mutatie)} ({cf.aantal}{" "}
              verrichtingen) — geen beginsaldo bekend.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const { vme, boekjaar, boekjaren } = await getActiveContext();
  if (!vme || !boekjaar) return <NoBoekjaar />;

  const db = createAdminClient();
  const [overzicht, controle, huurders, jaren, verbruik, gedeeld] =
    await Promise.all([
      vmeBoekjaarOverzicht(db, vme.id, boekjaar),
      voorschotControle(db, boekjaar.id),
      berekenHuurderAfrekeningen(db, boekjaar.id),
      jaarlijkseTotalen(db, vme.id, boekjaren),
      verbruik5Jaar(db, vme.id, boekjaren),
      gedeeldeKostenPerJaar(db, vme.id, boekjaren),
    ]);

  const bewoners = controle.filter((c) => c.soort === "bewoner");
  const afwijkingen = bewoners.filter((c) => Math.abs(c.afwijking) > 1);
  const actieveHuurders = huurders.filter((h) => h.actief);
  const totaalHuurderkosten = actieveHuurders.reduce(
    (s, h) => s + h.totaal_kosten,
    0,
  );
  const bankSaldo =
    (overzicht.zicht.saldoEind ?? overzicht.zicht.mutatie) +
    (overzicht.spaar.saldoEind ?? overzicht.spaar.mutatie);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{vme.naam}</h1>
        <p className="text-sm text-muted-foreground">
          {vme.adres ? `${vme.adres} · ` : ""}Boekjaar{" "}
          {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Inkomsten (spaarrekening)"
          value={euro(overzicht.spaar.totaalIn)}
          sub="reservefonds + kapitaalopvragingen"
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          label="Uitgaven (spaarrekening)"
          value={euro(Math.abs(overzicht.spaar.totaalUit))}
          sub="kosten + overboekingen"
          icon={TrendingDown}
          color="rose"
        />
        <StatCard
          label="Bank saldo"
          value={euro(bankSaldo)}
          sub="zicht + spaar"
          icon={Landmark}
          color="blue"
          href="/admin/bank"
        />
        <StatCard
          label="Contacten"
          value={overzicht.aantalEigenaars + overzicht.aantalHuurders}
          sub={`${overzicht.aantalEigenaars} eigenaars, ${overzicht.aantalHuurders} huurders`}
          icon={Users}
          color="violet"
          href="/admin/eigenaars"
        />
      </div>

      {overzicht.bankTeControleren > 0 && (
        <Link
          href="/admin/bank"
          className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
        >
          <AlertTriangle className="size-4 text-amber-600" />
          {overzicht.bankTeControleren} banktransactie(s) te controleren
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Snelle acties
        </h2>
        <QuickActions
          items={[
            {
              label: "Contacten",
              hint: "Eigenaars en huurders",
              icon: Users,
              color: "violet",
              href: "/admin/eigenaars",
            },
            {
              label: "Voorschotten",
              hint: "Maandelijkse voorschotten",
              icon: Wallet,
              color: "emerald",
              href: "/admin/voorschotten",
            },
            {
              label: "Meterstanden",
              hint: "Verbruik invoeren",
              icon: Gauge,
              color: "blue",
              href: "/admin/tellers",
            },
            {
              label: "Financiën",
              hint: "Kosten en bankimport",
              icon: Receipt,
              color: "amber",
              href: "/admin/kosten",
            },
            {
              label: "Documenten",
              hint: "Upload en beheer",
              icon: FileText,
              color: "indigo",
              href: "/admin/documenten",
            },
            {
              label: "Afrekening",
              hint: "Jaarafrekening",
              icon: Calculator,
              color: "rose",
              href: "/admin/afrekeningen",
            },
          ]}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Inkomsten en uitgaven van de VME
          </CardTitle>
          <CardDescription>
            Spaarrekening, laatste 5 boekjaren
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart data={jaren} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <RekeningKaart
          titel="VME zichtrekening"
          omschrijving="Werkrekening: voorschotten bewoners in, exploitatiekosten uit."
          cf={overzicht.zicht}
        />
        <RekeningKaart
          titel="VME spaarrekening"
          omschrijving="Reservefonds: provisies en kapitaalopvragingen in; kosten en overboekingen naar de werkrekening uit."
          cf={overzicht.spaar}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voorschotten huurders</CardTitle>
          <CardDescription>
            Heeft elke bewoner betaald wat t.e.m. vandaag verschuldigd is? Tussen
            haakjes: het bedrag voor het volledige boekjaar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bewoners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen huurdervoorschotten in dit boekjaar.
            </p>
          ) : (
            <>
              <p className="text-sm">
                {afwijkingen.length === 0 ? (
                  <Badge variant="secondary">
                    Alle {bewoners.length} bewoners in orde
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    {afwijkingen.length} afwijking(en) van {bewoners.length}
                  </Badge>
                )}
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bewoner</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Verwacht</TableHead>
                      <TableHead className="text-right">Ontvangen</TableHead>
                      <TableHead className="text-right">Afwijking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bewoners.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{c.wie}</TableCell>
                        <TableCell>{c.unit_naam}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(c.verwacht)}
                          {c.verwachtVol !== c.verwacht && (
                            <span className="block text-xs text-muted-foreground">
                              ({euro(c.verwachtVol)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(c.ontvangen)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              Math.abs(c.afwijking) > 1
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {euro(c.afwijking)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Kosten voor de huurders</CardTitle>
            <CardDescription>
              Totaal {euro(totaalHuurderkosten)} over {actieveHuurders.length}{" "}
              huurder(s). Detail en mailen via Afrekeningen.
            </CardDescription>
          </div>
          <Link
            href="/admin/afrekeningen"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Afrekeningen →
          </Link>
        </CardHeader>
        <CardContent>
          {actieveHuurders.length === 0 ? (
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
                    <TableHead className="text-right">Kosten</TableHead>
                    <TableHead className="text-right">Betaald</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actieveHuurders.map((h) => (
                    <TableRow key={h.huurder_id}>
                      <TableCell>{h.huurder_naam}</TableCell>
                      <TableCell>{h.unit_naam}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {euro(h.totaal_kosten)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {euro(h.voorschot_ontvangen)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={h.saldo < -1 ? "destructive" : "secondary"}
                        >
                          {euro(h.saldo)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verbruik per appartement</CardTitle>
          <CardDescription>
            Water en stookolie per boekjaar (m³ en €), laatste 5 boekjaren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerbruikOverzicht data={verbruik} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Gedeelde kosten van de blok
          </CardTitle>
          <CardDescription>
            Bevestigde kosten per categorie per boekjaar (laatste 5).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StackedBarChart
            categorieen={gedeeld.categorieen}
            jaren={gedeeld.jaren}
          />
          {gedeeld.categorieen.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categorie</TableHead>
                    {gedeeld.jaren.map((j) => (
                      <TableHead key={j.boekjaar_id} className="text-right">
                        {j.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gedeeld.categorieen.map((c) => (
                    <TableRow key={c}>
                      <TableCell className="capitalize">{c}</TableCell>
                      {gedeeld.jaren.map((j) => (
                        <TableCell
                          key={j.boekjaar_id}
                          className="text-right tabular-nums"
                        >
                          {j.perCategorie[c] ? euro(j.perCategorie[c]) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="font-medium">
                    <TableCell>Totaal</TableCell>
                    {gedeeld.jaren.map((j) => (
                      <TableCell
                        key={j.boekjaar_id}
                        className="text-right tabular-nums"
                      >
                        {euro(
                          gedeeld.categorieen.reduce(
                            (s, c) => s + (j.perCategorie[c] ?? 0),
                            0,
                          ),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
