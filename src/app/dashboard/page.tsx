import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
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
import type { Afrekening, Eigenaar, Unit } from "@/lib/types";

export const metadata = { title: "Mijn overzicht" };

export default async function DashboardPage() {
  await requireUser();
  const supabase = await createClient();
  const { vme, boekjaar } = await getActiveContext();

  // RLS: enkel de eigen records.
  const { data: eigenaars } = await supabase
    .from("eigenaar")
    .select("*")
    .returns<Eigenaar[]>();

  if (!eigenaars || eigenaars.length === 0) {
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

  if (!vme) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geen VME</CardTitle>
          <CardDescription>
            Er is geen VME beschikbaar voor je account.
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
  const unitIds = (units ?? []).map((u) => u.id);
  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const eigenInVme = eigenaars.filter((e) => unitIds.includes(e.unit_id));

  const { data: afrekeningen } =
    boekjaar && unitIds.length
      ? await supabase
          .from("afrekening")
          .select("*")
          .eq("boekjaar_id", boekjaar.id)
          .in("unit_id", unitIds)
          .returns<Afrekening[]>()
      : { data: [] as Afrekening[] };

  return (
    <div className="space-y-6">
      {!boekjaar && (
        <Card>
          <CardHeader>
            <CardDescription>
              Er is nog geen boekjaar voor {vme.naam}.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {eigenInVme.map((eig) => {
        const unit = unitById.get(eig.unit_id);
        const unitAfr = (afrekeningen ?? []).filter(
          (a) => a.unit_id === eig.unit_id,
        );

        return (
          <Card key={eig.id}>
            <CardHeader>
              <CardTitle>{unit?.naam ?? "Wooneenheid"}</CardTitle>
              <CardDescription>
                {[eig.voornaam, eig.naam].filter(Boolean).join(" ")}
                {boekjaar
                  ? ` · boekjaar ${datum(boekjaar.start_datum)} – ${datum(
                      boekjaar.eind_datum,
                    )}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-medium">
                  Jaarafrekening{boekjaar ? "" : " (kies een boekjaar)"}
                </h3>
                {unitAfr.length === 0 ? (
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
                      {unitAfr.map((a) => {
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
        );
      })}
    </div>
  );
}
