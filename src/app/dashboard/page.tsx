import Link from "next/link";
import { euro, datum, saldoRichting } from "@/lib/format";
import { eigenaarOverzicht } from "@/lib/eigenaar-overzicht";
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
import type { HuurderInfo } from "@/lib/types";

export const metadata = { title: "Mijn overzicht" };

function huurderPeriode(h: HuurderInfo) {
  return `${h.ingang_datum ? datum(h.ingang_datum) : "?"} – ${
    h.uitgang_datum ? datum(h.uitgang_datum) : "heden"
  }`;
}

export default async function DashboardPage() {
  const data = await eigenaarOverzicht(false);

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

  const { boekjaar, units } = data;

  return (
    <div className="space-y-6">
      {!boekjaar && (
        <Card>
          <CardHeader>
            <CardDescription>
              Er is nog geen boekjaar gekozen. Kies er een in de balk bovenaan.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {units.map((u) => (
        <Card key={u.unit.id}>
          <CardHeader>
            <CardTitle>{u.unit.naam}</CardTitle>
            <CardDescription>
              {boekjaar
                ? `Boekjaar ${datum(boekjaar.start_datum)} – ${datum(
                    boekjaar.eind_datum,
                  )}`
                : "Kies een boekjaar"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Huidige huurder:</span>
                {u.huidigeHuurder ? (
                  <span>
                    {u.huidigeHuurder.naam}
                    {u.huidigeHuurder.ingang_datum
                      ? ` · sinds ${datum(u.huidigeHuurder.ingang_datum)}`
                      : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    geen huurder geregistreerd
                  </span>
                )}
              </div>
              {u.vorigeHuurders.length > 0 && (
                <details className="text-muted-foreground">
                  <summary className="cursor-pointer">
                    Vorige huurders ({u.vorigeHuurders.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {u.vorigeHuurders.map((h) => (
                      <li key={h.id}>
                        {h.naam} · {huurderPeriode(h)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <Link
                href="/dashboard/contact"
                className="inline-block text-xs text-primary hover:underline"
              >
                huurders beheren →
              </Link>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium">
                Jaarafrekening{boekjaar ? "" : " (kies een boekjaar)"}
              </h3>
              {u.afrekeningen.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nog geen afrekening voor dit boekjaar.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Verschuldigd</TableHead>
                      <TableHead className="text-right">Ontvangen</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Mail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {u.afrekeningen.map((a) => {
                      const r = saldoRichting(Number(a.saldo));
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="capitalize">
                            {a.betaler_type}
                          </TableCell>
                          <TableCell className="text-right">
                            {euro(a.verschuldigd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {euro(a.ontvangen)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                r.bijbetaling ? "destructive" : "secondary"
                              }
                            >
                              {euro(a.saldo)} · {r.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.mail_verzonden_op
                              ? `Verzonden ${datum(a.mail_verzonden_op)}`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
