import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
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
import type { Eigenaar, Huurder, Transactie, Unit } from "@/lib/types";
import { suggestie, type Kandidaat } from "@/lib/bank-matching";
import { BankImporter } from "./bank-importer";
import { AssignRow } from "./assign-row";
import { SoortSelect } from "./soort-select";
import {
  assignTransactie,
  ontkoppelTransactie,
  deleteTransactie,
} from "./actions";

export const metadata = { title: "Bankimport" };

export default async function BankPage() {
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

  const [{ data: eigenaars }, { data: huurders }, { data: transacties }] =
    await Promise.all([
      unitIds.length
        ? supabase.from("eigenaar").select("*").in("unit_id", unitIds).returns<Eigenaar[]>()
        : Promise.resolve({ data: [] as Eigenaar[] }),
      unitIds.length
        ? supabase.from("huurder").select("*").in("unit_id", unitIds).returns<Huurder[]>()
        : Promise.resolve({ data: [] as Huurder[] }),
      supabase
        .from("transactie")
        .select("*")
        .eq("vme_id", active.id)
        .order("datum", { ascending: false })
        .returns<Transactie[]>(),
    ]);

  const kandidaten: Kandidaat[] = [
    ...(eigenaars ?? []).map((e) => ({
      unit_id: e.unit_id,
      naam: e.naam,
      iban: e.iban ?? null,
      structuurcode_prefix: e.structuurcode_prefix,
      betaler_type: "eigenaar" as const,
    })),
    ...(huurders ?? []).map((h) => ({
      unit_id: h.unit_id,
      naam: [h.voornaam, h.naam].filter(Boolean).join(" ") || h.naam,
      iban: h.iban ?? null,
      structuurcode_prefix: null,
      betaler_type: "huurder" as const,
    })),
  ];

  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));
  const onbevestigd = (transacties ?? []).filter(
    (t) => t.match_type === "onbevestigd" || t.match_type === null,
  );
  // Kosten / interne overboekingen / rente / vorig-jaar-afrekeningen hoeven niet
  // aan een unit gekoppeld te worden -> apart tonen, niet als "te controleren".
  const GEEN_MATCH_NODIG = new Set([
    "kost",
    "interne_overboeking",
    "rente",
    "afrekening",
    "kapitaalsoproep",
  ]);
  const teControleren = onbevestigd.filter(
    (t) => !GEEN_MATCH_NODIG.has(t.soort),
  );
  const verwerkt = onbevestigd.filter((t) => GEEN_MATCH_NODIG.has(t.soort));
  const toegewezen = (transacties ?? []).filter(
    (t) => t.match_type === "automatisch" || t.match_type === "manueel",
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bankexport importeren</CardTitle>
          <CardDescription>
            KBC-PDF of XLS/XLSX. De app herkent de rekening (zicht/spaar) en de
            soort verrichting (voorschot, kost, afrekening vorig jaar, interne
            overboeking, kapitaalsoproep, …). Enkel <strong>voorschotten</strong>{" "}
            tellen mee in de jaarafrekening. Niets wordt stil genegeerd.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankImporter
            vmeId={active.id}
            boekjaarStart={boekjaar.start_datum}
            boekjaarEind={boekjaar.eind_datum}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Te controleren ({teControleren.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {teControleren.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen openstaande transacties.
            </p>
          ) : (
            teControleren.map((t) => {
              const sug = suggestie(t.tegenpartij_naam, kandidaten);
              return (
                <div key={t.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {datum(t.datum)} · {euro(t.bedrag)}
                    </span>
                    <span className="text-muted-foreground">
                      {t.tegenpartij_naam ?? "geen tegenpartij"}
                    </span>
                  </div>
                  {t.mededeling && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.mededeling}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <SoortSelect id={t.id} waarde={t.soort} />
                    {t.rekening && (
                      <span className="text-muted-foreground">
                        {t.rekening}rekening
                      </span>
                    )}
                    {t.tegenpartij_iban && (
                      <span className="font-mono text-muted-foreground">
                        {t.tegenpartij_iban}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {sug && (
                      <ActionForm
                        action={assignTransactie}
                        hiddenFields={{
                          id: t.id,
                          unit_id: sug.unit_id,
                          betaler_type: sug.betaler_type,
                        }}
                      >
                        <SubmitButton size="sm">
                          Suggestie: {sug.naam} ({sug.betaler_type},{" "}
                          {Math.round(sug.score * 100)}%)
                        </SubmitButton>
                      </ActionForm>
                    )}
                    <AssignRow transactieId={t.id} units={units ?? []} />
                    <ActionForm action={deleteTransactie} hiddenFields={{ id: t.id }}>
                      <ConfirmSubmit message="Transactie verwijderen?" />
                    </ActionForm>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {verwerkt.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kosten & overboekingen ({verwerkt.length})</CardTitle>
            <CardDescription>
              Deze hoeven niet aan een unit gekoppeld te worden. Kosten worden
              via <strong>Kosten → “Genereer uit bank”</strong> geboekt (of ze
              zitten al in een geaggregeerde kost). Klopt de soort niet? Pas ze
              hier aan.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead>Tegenpartij</TableHead>
                  <TableHead>Mededeling</TableHead>
                  <TableHead>Soort</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verwerkt.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{datum(t.datum)}</TableCell>
                    <TableCell className="text-right">{euro(t.bedrag)}</TableCell>
                    <TableCell>{t.tegenpartij_naam ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {t.mededeling ?? "—"}
                    </TableCell>
                    <TableCell>
                      <SoortSelect id={t.id} waarde={t.soort} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Toegewezen ({toegewezen.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {toegewezen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog niets toegewezen.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                    <TableHead>Tegenpartij</TableHead>
                    <TableHead>Rek.</TableHead>
                    <TableHead>Soort</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Betaler</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {toegewezen.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{datum(t.datum)}</TableCell>
                      <TableCell className="text-right">
                        {euro(t.bedrag)}
                      </TableCell>
                      <TableCell>{t.tegenpartij_naam ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {t.rekening ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.soort}</Badge>
                      </TableCell>
                      <TableCell>
                        {t.gematchte_unit_id
                          ? unitNaam.get(t.gematchte_unit_id) ?? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {t.betaler_type ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.match_type === "automatisch"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {t.match_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionForm
                          action={ontkoppelTransactie}
                          hiddenFields={{ id: t.id }}
                        >
                          <SubmitButton variant="ghost" size="sm">
                            Ontkoppelen
                          </SubmitButton>
                        </ActionForm>
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
