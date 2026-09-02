import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { datum, euro } from "@/lib/format";
import { premiesVoorBoekjaar, vervaltStatus } from "@/lib/verzekering";
import { NoVme } from "@/components/no-vme";
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
import {
  POLIS_TYPE_LABEL,
  SCHADE_STATUS_LABEL,
  type Unit,
  type VerzekeringPolis,
  type VerzekeringSchade,
} from "@/lib/types";
import {
  CreateSchadeForm,
  EditPolisDialog,
  EditSchadeDialog,
} from "../verzekeringen-forms";

export const metadata = { title: "Polis" };

export default async function PolisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { vme, boekjaar } = await getActiveContext();
  if (!vme) return <NoVme />;

  const db = createAdminClient();
  const supabase = await createClient();

  const { data: polis } = await db
    .from("verzekering_polis")
    .select("*")
    .eq("id", id)
    .eq("vme_id", vme.id)
    .maybeSingle<VerzekeringPolis>();
  if (!polis) notFound();

  const [{ data: schadeRows }, { data: unitRows }, { data: docRows }] =
    await Promise.all([
      db
        .from("verzekering_schade")
        .select("*")
        .eq("polis_id", id)
        .order("datum", { ascending: false })
        .returns<VerzekeringSchade[]>(),
      db
        .from("unit")
        .select("*")
        .eq("vme_id", vme.id)
        .order("naam")
        .returns<Unit[]>(),
      supabase
        .from("document")
        .select("id, naam")
        .eq("vme_id", vme.id)
        .order("created_at", { ascending: false }),
    ]);

  const schades = schadeRows ?? [];
  const units = unitRows ?? [];
  const documenten = (docRows ?? []) as { id: string; naam: string }[];
  const unitNaam = new Map(units.map((u) => [u.id, u.naam]));
  const polisDoc = documenten.find((d) => d.id === polis.document_id);

  const premies = boekjaar
    ? await premiesVoorBoekjaar(db, vme.id, boekjaar.id, polis.maatschappij)
    : { totaal: 0, regels: [] };
  const vs = vervaltStatus(polis);

  return (
    <div className="space-y-5">
      <TerugLink href="/admin/verzekeringen">Alle polissen</TerugLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {polis.maatschappij}
            {!polis.actief && (
              <Badge variant="outline" className="ml-2">
                inactief
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {POLIS_TYPE_LABEL[polis.type]}
            {polis.polisnummer && ` · polis ${polis.polisnummer}`}
            {polis.makelaar && ` · makelaar ${polis.makelaar}`}
          </p>
        </div>
        <EditPolisDialog polis={polis} documenten={documenten} />
      </div>

      <Card>
        <CardContent className="grid gap-x-8 gap-y-2 pt-6 text-sm sm:grid-cols-2">
          <Rij label="Jaarpremie" value={polis.jaarpremie != null ? euro(polis.jaarpremie) : "—"} />
          <Rij
            label="Vervaldatum"
            value={
              <>
                {polis.vervaldatum ? datum(polis.vervaldatum) : "—"}
                {vs === "verlopen" && (
                  <Badge variant="destructive" className="ml-2">
                    verlopen
                  </Badge>
                )}
                {vs === "binnenkort" && (
                  <Badge variant="outline" className="ml-2">
                    vervalt binnenkort
                  </Badge>
                )}
              </>
            }
          />
          <Rij label="Ingangsdatum" value={polis.ingang_datum ? datum(polis.ingang_datum) : "—"} />
          <Rij label="Hoofdvervaldag" value={polis.hoofdvervaldag ?? "—"} />
          <Rij label="Polisdocument" value={polisDoc ? `📎 ${polisDoc.naam}` : "—"} />
          {polis.opmerkingen && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Opmerkingen</p>
              <p>{polis.opmerkingen}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {boekjaar && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Betaalde premies dit boekjaar
            </CardTitle>
            <CardDescription>
              Verzekeringskosten waarvan de omschrijving/leverancier “
              {polis.maatschappij}” bevat, {datum(boekjaar.start_datum)} –{" "}
              {datum(boekjaar.eind_datum)}. Totaal{" "}
              <strong className="text-foreground">{euro(premies.totaal)}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {premies.regels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen gekoppelde premiebetalingen gevonden.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {premies.regels.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{datum(r.datum)}</TableCell>
                      <TableCell>
                        {r.omschrijving ?? r.leverancier ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {euro(r.bedrag)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Schadedossiers ({schades.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {schades.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Schade</TableHead>
                    <TableHead className="text-right">Uitgekeerd</TableHead>
                    <TableHead>Dossiernr.</TableHead>
                    <TableHead>Appartement</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schades.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{datum(s.datum)}</TableCell>
                      <TableCell>{s.omschrijving}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.status === "afgehandeld"
                              ? "secondary"
                              : s.status === "geweigerd"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {SCHADE_STATUS_LABEL[s.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.schadebedrag != null ? euro(s.schadebedrag) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.uitgekeerd_bedrag != null
                          ? euro(s.uitgekeerd_bedrag)
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.dossiernummer ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.unit_id
                          ? (unitNaam.get(s.unit_id) ?? "—")
                          : "gemene delen"}
                      </TableCell>
                      <TableCell className="text-right">
                        <EditSchadeDialog
                          schade={s}
                          units={units}
                          documenten={documenten}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">Schadedossier toevoegen</p>
            <CreateSchadeForm
              vmeId={vme.id}
              polisId={polis.id}
              units={units}
              documenten={documenten}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Rij({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
