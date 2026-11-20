import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { laadHuurderContext } from "@/lib/huurder-detail";
import { bouwKaart, type KaartBlok } from "@/lib/huurder-kaart";
import { euro, datum, saldoRichting } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { TerugLink } from "@/components/terug-link";
import { Badge } from "@/components/ui/badge";
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

export const metadata = { title: "Detailkaart huurder" };

const getal = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("nl-BE", { maximumFractionDigits: 3 });

function BlokRijen({ blok }: { blok: KaartBlok }) {
  return (
    <>
      {blok.rijen.map((r) => (
        <TableRow key={r.label}>
          <TableCell>{r.label}</TableCell>
          <TableCell className="text-right tabular-nums">
            {getal(r.begin)}
            {r.beginDatum && (
              <span className="block text-[11px] text-muted-foreground">
                {datum(r.beginDatum)}
              </span>
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {getal(r.eind)}
            {r.eindDatum && (
              <span className="block text-[11px] text-muted-foreground">
                {datum(r.eindDatum)}
              </span>
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums">{getal(r.delta)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {getal(r.hoeveelheid)} {r.eenheid}
          </TableCell>
          <TableCell className="text-right tabular-nums">{euro(r.bedrag)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="font-medium">
        <TableCell colSpan={4} />
        <TableCell className="text-right tabular-nums">
          {getal(blok.totaalHoeveelheid)} {blok.eenheid}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {euro(blok.totaalBedrag)}
        </TableCell>
      </TableRow>
    </>
  );
}

export default async function DetailKaartPage({
  params,
}: PageProps<"/admin/detail-huurders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const ctx = await laadHuurderContext();
  if (!ctx) return <NoBoekjaar />;
  const h = ctx.resultaten.find((x) => x.huurder_id === id);
  if (!h) notFound();

  const kaart = bouwKaart(h, ctx.parameters);
  const r = saldoRichting(h.saldo);

  return (
    <div className="space-y-5">
      <TerugLink href="/admin/detail-huurders">Detail huurders</TerugLink>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Detailkaart — {h.huurder_naam}
            {h.vertrokken_in_boekjaar && (
              <Badge variant="secondary">vertrokken in dit boekjaar</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {h.unit_naam} · periode {datum(h.periode_start)} –{" "}
            {datum(h.periode_eind)} ({h.dagen} van {h.boekjaar_dagen} dagen)
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

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead className="text-right">Startstand</TableHead>
                  <TableHead className="text-right">Eindstand</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">In liters / m³</TableHead>
                  <TableHead className="text-right">In euro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <BlokRijen blok={kaart.stookolie} />
                <TableRow>
                  <TableCell colSpan={6} className="h-3 p-0" />
                </TableRow>
                <BlokRijen blok={kaart.water} />
              </TableBody>
            </Table>
          </div>

          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between border-b py-1.5">
              <dt className="text-muted-foreground">Ontvangen voorschotten</dt>
              <dd className="font-medium tabular-nums">
                {euro(h.voorschot_ontvangen)}
              </dd>
            </div>
            <div className="flex justify-between border-b py-1.5">
              <dt className="text-muted-foreground">Totaal kosten (afrekening)</dt>
              <dd className="font-medium tabular-nums">{euro(h.totaal_kosten)}</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-muted-foreground">Saldo</dt>
              <dd className="flex items-center gap-2 font-medium tabular-nums">
                {euro(h.saldo)}
                <Badge variant={r.bijbetaling ? "destructive" : "secondary"}>
                  {r.label}
                </Badge>
              </dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            Deze kaart is een overzicht. Pas gegevens aan bij{" "}
            <Link href="/admin/meterstanden" className="underline">
              Meterstanden
            </Link>
            ,{" "}
            <Link href="/admin/tarieven" className="underline">
              Tarieven &amp; parameters
            </Link>
            ,{" "}
            <Link href="/admin/kosten/huurders" className="underline">
              Kosten
            </Link>{" "}
            en{" "}
            <Link href="/admin/financien/zicht" className="underline">
              Zichtrekening
            </Link>{" "}
            (voorschotten). De afrekening zelf vind je onder{" "}
            <Link
              href={`/admin/afrekeningen/huurder/${h.huurder_id}?boekjaar=${ctx.boekjaar.id}`}
              className="underline"
            >
              Afrekening huurders
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
