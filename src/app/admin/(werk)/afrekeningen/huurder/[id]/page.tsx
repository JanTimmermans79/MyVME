import Link from "next/link";
import { notFound } from "next/navigation";
import { TerugLink } from "@/components/terug-link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveVme } from "@/lib/vme-context";
import { euro, datum, saldoRichting } from "@/lib/format";
import { berekenHuurderAfrekeningen } from "@/lib/huurder-afrekening";
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
import type { Afrekening } from "@/lib/types";
import { HuurderAfrekeningVerstuur } from "./verstuur";

export const metadata = { title: "Afrekening huurder" };

export default async function HuurderAfrekeningDetail({
  params,
  searchParams,
}: PageProps<"/admin/afrekeningen/huurder/[id]">) {
  await requireAdmin();
  const { id: huurderId } = await params;
  const sp = await searchParams;
  const boekjaarId = typeof sp.boekjaar === "string" ? sp.boekjaar : undefined;

  const { active } = await getActiveVme();
  const db = createAdminClient();

  const { data: boekjaar } = boekjaarId
    ? await db
        .from("boekjaar")
        .select("id, start_datum, eind_datum")
        .eq("id", boekjaarId)
        .maybeSingle<{ id: string; start_datum: string; eind_datum: string }>()
    : { data: null };
  if (!boekjaar) notFound();

  const resultaten = await berekenHuurderAfrekeningen(db, boekjaar.id);
  const h = resultaten.find((x) => x.huurder_id === huurderId);
  if (!h) notFound();

  const { data: opgeslagen } = await db
    .from("afrekening")
    .select("*")
    .eq("boekjaar_id", boekjaar.id)
    .eq("huurder_id", huurderId)
    .eq("betaler_type", "huurder")
    .maybeSingle<Afrekening>();

  const r = saldoRichting(h.saldo);
  const periode = `${datum(h.periode_start)} – ${datum(h.periode_eind)}`;

  // §19 — elke regel wijst naar zijn bron.
  const lijnHref = (soort: string): string =>
    soort === "gedeeld"
      ? `/admin/dashboard/zicht-uit?bj=${boekjaar.id}`
      : "/admin/meterstanden";
  const lijnenTekst = h.lijnen
    .map(
      (l) =>
        `${l.omschrijving}: ${l.hoeveelheid ?? ""} ${l.eenheid ?? ""} → ${euro(l.bedrag)}`,
    )
    .join("\n");

  return (
    <div className="space-y-6">
      <TerugLink href={`/admin/afrekeningen?boekjaar=${boekjaar.id}`}>
        Alle afrekeningen
      </TerugLink>

      <Card>
        <CardHeader>
          <CardTitle>
            Afrekening — {h.huurder_naam} ({h.unit_naam})
          </CardTitle>
          <CardDescription>
            Periode {periode} · {h.dagen} van {h.boekjaar_dagen} dagen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {h.waarschuwingen.length > 0 && (
            <ul className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {h.waarschuwingen.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead className="text-right">Hoeveelheid</TableHead>
                <TableHead className="text-right">Eenheidsprijs</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {h.lijnen.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Link
                      href={lijnHref(l.soort)}
                      className="hover:underline"
                    >
                      {l.omschrijving} →
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.hoeveelheid ?? "—"} {l.eenheid ?? ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.eenheidsprijs != null ? euro(l.eenheidsprijs) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{euro(l.bedrag)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell colSpan={3}>Totaal kosten</TableCell>
                <TableCell className="text-right">
                  {euro(h.totaal_kosten)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3}>
                  <Link
                    href={`/admin/financien/zicht/voorschotcontrole`}
                    className="hover:underline"
                  >
                    Voorschotten betaald (verwacht {euro(h.voorschot_verwacht)}) →
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {euro(h.voorschot_ontvangen)}
                </TableCell>
              </TableRow>
              <TableRow className="text-base font-semibold">
                <TableCell colSpan={3}>
                  Saldo — <Badge variant={r.bijbetaling ? "destructive" : "secondary"}>{r.label}</Badge>
                </TableCell>
                <TableCell className="text-right">{euro(h.saldo)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <HuurderAfrekeningVerstuur
            data={{
              afrekening_id: opgeslagen?.id ?? null,
              to_email: h.huurder_email,
              to_name: h.huurder_naam,
              vme_naam: active?.naam ?? "",
              vme_iban: active?.iban ?? "",
              periode,
              unit_naam: h.unit_naam,
              lijnen_tekst: lijnenTekst,
              totaal_kosten: h.totaal_kosten,
              voorschot_ontvangen: h.voorschot_ontvangen,
              saldo: h.saldo,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
