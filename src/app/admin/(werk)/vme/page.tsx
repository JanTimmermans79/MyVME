import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { datum } from "@/lib/format";
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
import type { Vme } from "@/lib/types";
import { CreateVmeForm, EditVmeDialog } from "./vme-forms";

export const metadata = { title: "VME-gegevens" };

/** Toont "—" voor lege waarden; datums netjes geformatteerd. */
function waarde(v: string | number | null, isDatum = false): string {
  if (v == null || v === "") return "—";
  return isDatum ? datum(String(v)) : String(v);
}

function GegevensRij({
  label,
  value,
  isDatum,
}: {
  label: string;
  value: string | number | null;
  isDatum?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{waarde(value, isDatum)}</dd>
    </div>
  );
}

function VmeGegevensOverzicht({ vme }: { vme: Vme }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>VME-gegevens — {vme.naam}</CardTitle>
        <CardDescription>
          Algemene en juridische gegevens (KBO). Aanpasbaar via “Bewerken” in de
          lijst hieronder.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        <dl>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Algemeen
          </p>
          <GegevensRij label="Ondernemingsnummer" value={vme.ondernemingsnummer} />
          <GegevensRij label="Status" value={vme.kbo_status} />
          <GegevensRij label="Rechtstoestand" value={vme.rechtstoestand} />
          <GegevensRij label="Begindatum" value={vme.begindatum} isDatum />
          <GegevensRij label="Type entiteit" value={vme.type_entiteit} />
          <GegevensRij label="Rechtsvorm" value={vme.rechtsvorm} />
          <GegevensRij label="Aantal appartementen" value={vme.aantal_kavels} />
        </dl>
        <dl>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Naam &amp; zetel
          </p>
          <GegevensRij label="Officiële naam" value={vme.officiele_naam} />
          <GegevensRij label="Afkorting" value={vme.afkorting} />
          <GegevensRij label="Adres van de zetel" value={vme.zetel_adres} />
          <GegevensRij label="Adres (werking)" value={vme.adres} />
        </dl>
        <dl>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact
          </p>
          <GegevensRij label="Telefoonnummer" value={vme.telefoon} />
          <GegevensRij label="E-mail" value={vme.email} />
          <GegevensRij label="Webadres" value={vme.webadres} />
        </dl>
        <dl>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Syndicus &amp; bankrekeningen
          </p>
          <GegevensRij label="Syndicus" value={vme.syndicus_naam} />
          <GegevensRij label="Syndicus sinds" value={vme.syndicus_sinds} isDatum />
          <GegevensRij label="Zichtrekening" value={vme.iban} />
          <GegevensRij label="Spaarrekening" value={vme.iban_reserve} />
        </dl>
      </CardContent>
    </Card>
  );
}

export default async function VmePage() {
  const supabase = await createClient();
  const [{ data: vmes }, { vme: actief }] = await Promise.all([
    supabase.from("vme").select("*").order("naam").returns<Vme[]>(),
    getActiveContext(),
  ]);

  const actieveVme = (vmes ?? []).find((v) => v.id === actief?.id) ?? null;

  return (
    <div className="space-y-6">
      {actieveVme && <VmeGegevensOverzicht vme={actieveVme} />}

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe VME</CardTitle>
          <CardDescription>
            Het datamodel ondersteunt meerdere VME&apos;s per syndicus. De
            VME-gegevens zijn optioneel en later aanpasbaar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateVmeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VME&apos;s ({vmes?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!vmes || vmes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen VME&apos;s.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead className="text-right">App.</TableHead>
                    <TableHead>Zichtrekening</TableHead>
                    <TableHead>Spaarrekening (reservefonds)</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vmes.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.naam}</TableCell>
                      <TableCell className="text-right">
                        {v.aantal_kavels ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.iban ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.iban_reserve ?? "—"}
                      </TableCell>
                      <TableCell>{v.adres ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <EditVmeDialog vme={v} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
