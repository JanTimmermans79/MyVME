import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
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
import type { Eigenaar, Huurder, Unit } from "@/lib/types";

export const metadata = { title: "Contacten" };

const naamVan = (p: { voornaam: string | null; naam: string }) =>
  [p.voornaam, p.naam].filter(Boolean).join(" ");

function ContactCel({
  email,
  telefoon,
  iban,
}: {
  email: string | null;
  telefoon: string | null;
  iban: string | null;
}) {
  return (
    <div className="text-xs text-muted-foreground">
      <div>{email ?? "geen e-mail"}</div>
      {telefoon && <div>{telefoon}</div>}
      {iban && <div className="font-mono">{iban}</div>}
    </div>
  );
}

export default async function ContactenPage() {
  const { vme, boekjaar } = await getActiveContext();
  if (!vme || !boekjaar) return <NoBoekjaar />;

  const db = createAdminClient();
  const { data: unitRows } = await db
    .from("unit")
    .select("*")
    .eq("vme_id", vme.id)
    .order("naam")
    .returns<Unit[]>();
  const units = unitRows ?? [];
  const unitIds = units.map((u) => u.id);

  const [{ data: eigenaars }, { data: huurders }] = unitIds.length
    ? await Promise.all([
        db.from("eigenaar").select("*").in("unit_id", unitIds).returns<Eigenaar[]>(),
        db.from("huurder").select("*").in("unit_id", unitIds).returns<Huurder[]>(),
      ])
    : [{ data: [] as Eigenaar[] }, { data: [] as Huurder[] }];

  const eigenaarByUnit = new Map<string, Eigenaar>();
  for (const e of eigenaars ?? [])
    if (!eigenaarByUnit.has(e.unit_id)) eigenaarByUnit.set(e.unit_id, e);

  // Huurders met een huurperiode die in dit boekjaar valt.
  const huurdersInBoekjaar = (huurders ?? []).filter((h) => {
    const s = h.ingang_datum ?? "0000-01-01";
    const e = h.uitgang_datum ?? "9999-12-31";
    return s <= boekjaar.eind_datum && e >= boekjaar.start_datum;
  });
  const huurdersByUnit = new Map<string, Huurder[]>();
  for (const h of huurdersInBoekjaar) {
    const l = huurdersByUnit.get(h.unit_id) ?? [];
    l.push(h);
    huurdersByUnit.set(h.unit_id, l);
  }

  const aantalEigenaars = new Set(
    (eigenaars ?? []).map((e) => e.id),
  ).size;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Terug naar dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Contacten</h1>
        <p className="text-sm text-muted-foreground">
          Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)} ·{" "}
          {aantalEigenaars} eigenaar(s), {huurdersInBoekjaar.length} huurder(s)
          actief in dit boekjaar. Beheren via{" "}
          <Link href="/admin/eigenaars" className="underline">
            Eigenaars
          </Link>{" "}
          en{" "}
          <Link href="/admin/huurders" className="underline">
            Huurders
          </Link>
          .
        </p>
      </div>

      {units.map((u) => {
        const eig = eigenaarByUnit.get(u.id);
        const hrs = huurdersByUnit.get(u.id) ?? [];
        return (
          <Card key={u.id}>
            <CardHeader>
              <CardTitle className="text-base">{u.naam}</CardTitle>
              <CardDescription>
                {eig ? naamVan(eig) : "geen eigenaar"} ·{" "}
                {hrs.length === 0
                  ? "geen huurder dit boekjaar (eigenaar-bewoner of leegstand)"
                  : `${hrs.length} huurder(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rol</TableHead>
                      <TableHead>Naam</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Periode in dit boekjaar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Badge variant="secondary">Eigenaar</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {eig ? naamVan(eig) : "—"}
                      </TableCell>
                      <TableCell>
                        {eig ? (
                          <ContactCel
                            email={eig.email}
                            telefoon={eig.telefoon}
                            iban={eig.iban}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        volledig boekjaar
                      </TableCell>
                    </TableRow>
                    {hrs.map((h) => {
                      const start =
                        (h.ingang_datum ?? boekjaar.start_datum) >
                        boekjaar.start_datum
                          ? h.ingang_datum!
                          : boekjaar.start_datum;
                      const eind =
                        (h.uitgang_datum ?? boekjaar.eind_datum) <
                        boekjaar.eind_datum
                          ? h.uitgang_datum!
                          : boekjaar.eind_datum;
                      return (
                        <TableRow key={h.id}>
                          <TableCell>
                            <Badge variant="outline">Huurder</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {naamVan(h)}
                          </TableCell>
                          <TableCell>
                            <ContactCel
                              email={h.email}
                              telefoon={h.telefoon}
                              iban={h.iban}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {datum(start)} – {datum(eind)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
