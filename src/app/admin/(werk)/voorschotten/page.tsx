import { createClient } from "@/lib/supabase/server";
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
import type {
  Boekjaar,
  Huurder,
  Unit,
  VoorschotEigenaar,
  VoorschotHuurder,
} from "@/lib/types";
import { VoorschotEigenaarRij, VoorschotHuurderRij } from "./voorschot-form";

export const metadata = { title: "Voorschotten" };

function overlapt(h: Huurder, b: Boekjaar): boolean {
  const start = h.ingang_datum ?? "0000-01-01";
  const eind = h.uitgang_datum ?? "9999-12-31";
  return start <= b.eind_datum && eind >= b.start_datum;
}

export default async function VoorschottenPage() {
  const { vme: active, boekjaar } = await getActiveContext();
  if (!active || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();

  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .eq("vme_id", active.id)
    .order("naam")
    .returns<Unit[]>();
  const unitIds = (units ?? []).map((u) => u.id);

  const { data: huurders } = unitIds.length
    ? await supabase
        .from("huurder")
        .select("*")
        .in("unit_id", unitIds)
        .returns<Huurder[]>()
    : { data: [] as Huurder[] };

  const [{ data: vse }, { data: vsh }] = await Promise.all([
    supabase
      .from("voorschot_eigenaar")
      .select("*")
      .eq("boekjaar_id", boekjaar.id)
      .returns<VoorschotEigenaar[]>(),
    supabase
      .from("voorschot_huurder")
      .select("*")
      .eq("boekjaar_id", boekjaar.id)
      .returns<VoorschotHuurder[]>(),
  ]);

  const vseByUnit = new Map((vse ?? []).map((v) => [v.unit_id, v.bedrag_per_maand]));
  const vshByHuurder = new Map(
    (vsh ?? []).map((v) => [v.huurder_id, v.bedrag_per_maand]),
  );
  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Voorschotten</h1>
        <p className="text-sm text-muted-foreground">
          Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}.
          Eigenaars: reservefonds-provisie (AV), per unit. Huurders: variabel,
          per huurder.
        </p>
      </div>

      <Card>
            <CardHeader>
              <CardTitle className="text-base">Eigenaars</CardTitle>
            </CardHeader>
            <CardContent>
              {!units || units.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen units.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Voorschot / maand</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.naam}</TableCell>
                        <TableCell>
                          <VoorschotEigenaarRij
                            unitId={u.id}
                            boekjaarId={boekjaar.id}
                            huidig={vseByUnit.get(u.id) ?? null}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Huurders</CardTitle>
              <CardDescription>
                Enkel huurders met een huurperiode die in dit boekjaar valt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const relevante = (huurders ?? []).filter((h) =>
                  overlapt(h, boekjaar),
                );
                if (relevante.length === 0)
                  return (
                    <p className="text-sm text-muted-foreground">
                      Geen huurders in dit boekjaar.
                    </p>
                  );
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Huurder</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Voorschot / maand</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relevante.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>
                            {[h.voornaam, h.naam].filter(Boolean).join(" ")}
                          </TableCell>
                          <TableCell>{unitNaam.get(h.unit_id) ?? "—"}</TableCell>
                          <TableCell>
                            <VoorschotHuurderRij
                              huurderId={h.id}
                              boekjaarId={boekjaar.id}
                              huidig={vshByHuurder.get(h.id) ?? null}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
    </div>
  );
}
