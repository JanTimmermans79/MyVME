import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { euro, datum, saldoRichting } from "@/lib/format";
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
import type { Afrekening, Eigenaar, Transactie, Unit } from "@/lib/types";

export const metadata = { title: "Mijn overzicht" };

export default async function DashboardPage() {
  await requireUser();
  const supabase = await createClient();

  // RLS zorgt ervoor dat enkel de eigen records terugkomen.
  const { data: eigenaars } = await supabase
    .from("eigenaar")
    .select("*")
    .returns<Eigenaar[]>();

  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .returns<Unit[]>();

  const jaarStart = `${new Date().getFullYear()}-01-01`;
  const { data: transacties } = await supabase
    .from("transactie")
    .select("*")
    .gte("datum", jaarStart)
    .returns<Transactie[]>();

  const { data: afrekeningen } = await supabase
    .from("afrekening")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Afrekening[]>();

  if (!eigenaars || eigenaars.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nog niet gekoppeld</CardTitle>
          <CardDescription>
            Je account is nog niet aan een unit gekoppeld. Neem contact op met de
            syndicus.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      {eigenaars.map((eig) => {
        const unit = unitById.get(eig.unit_id);
        const unitTx = (transacties ?? []).filter(
          (t) => t.gematchte_unit_id === eig.unit_id,
        );
        const perBetaler = (["eigenaar", "huurder"] as const).map((bt) => ({
          betaler_type: bt,
          totaal: unitTx
            .filter((t) => t.betaler_type === bt)
            .reduce((s, t) => s + Number(t.bedrag), 0),
        }));
        const unitAfrekeningen = (afrekeningen ?? []).filter(
          (a) => a.unit_id === eig.unit_id,
        );

        return (
          <Card key={eig.id}>
            <CardHeader>
              <CardTitle>{unit?.naam ?? "Unit"}</CardTitle>
              <CardDescription>
                Eigenaar: {[eig.voornaam, eig.naam].filter(Boolean).join(" ")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-medium">
                  Betalingen dit kalenderjaar
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {perBetaler.map((s) => (
                    <div key={s.betaler_type} className="rounded-lg border p-3">
                      <p className="text-xs uppercase text-muted-foreground">
                        {s.betaler_type}
                      </p>
                      <p className="text-lg font-semibold">{euro(s.totaal)}</p>
                      <p className="text-xs text-muted-foreground">
                        totaal ontvangen en gematcht
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">Jaarafrekeningen</h3>
                {unitAfrekeningen.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog geen afrekeningen.
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
                      {unitAfrekeningen.map((a) => {
                        const r = saldoRichting(a.saldo);
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
        );
      })}
    </div>
  );
}
