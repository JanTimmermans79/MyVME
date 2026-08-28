import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoVme } from "@/components/no-vme";
import { BoekjaarKiezer } from "@/components/boekjaar-kiezer";
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

export default async function VoorschottenPage({
  searchParams,
}: PageProps<"/admin/voorschotten">) {
  const { active } = await getActiveVme();
  if (!active) return <NoVme />;

  const sp = await searchParams;
  const supabase = await createClient();

  const { data: boekjaren } = await supabase
    .from("boekjaar")
    .select("*")
    .eq("vme_id", active.id)
    .order("start_datum", { ascending: false })
    .returns<Boekjaar[]>();

  const opts = (boekjaren ?? []).map((b) => ({
    id: b.id,
    label: `${datum(b.start_datum)} – ${datum(b.eind_datum)}`,
  }));
  const gekozenId =
    (typeof sp.boekjaar === "string" ? sp.boekjaar : undefined) ??
    boekjaren?.[0]?.id;
  const boekjaar = (boekjaren ?? []).find((b) => b.id === gekozenId);

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

  const [{ data: vse }, { data: vsh }] = boekjaar
    ? await Promise.all([
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
      ])
    : [{ data: [] as VoorschotEigenaar[] }, { data: [] as VoorschotHuurder[] }];

  const vseByUnit = new Map((vse ?? []).map((v) => [v.unit_id, v.bedrag_per_maand]));
  const vshByHuurder = new Map(
    (vsh ?? []).map((v) => [v.huurder_id, v.bedrag_per_maand]),
  );
  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voorschotten per boekjaar</CardTitle>
          <CardDescription>
            Eigenaars: bepaald op de algemene vergadering, per unit. Huurders:
            variabel, per huurder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {opts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Maak eerst een boekjaar aan.
            </p>
          ) : (
            <BoekjaarKiezer
              basePath="/admin/voorschotten"
              boekjaren={opts}
              actief={gekozenId ?? ""}
            />
          )}
        </CardContent>
      </Card>

      {boekjaar && (
        <>
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
        </>
      )}
    </div>
  );
}
