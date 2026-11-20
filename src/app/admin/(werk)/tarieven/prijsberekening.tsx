"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { datum, euro } from "@/lib/format";
import { uploadDocumenten } from "../documenten/actions";
import { createMazout, deleteMazout } from "../mazout/actions";
import { mazoutprijsUitLeveringen } from "./actions";

const num = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Bewijsstuk (factuur, tariefblad) bij een prijsberekening: komt in Documenten. */
function BewijsUpload({
  vmeId,
  boekjaarId,
  categorie,
}: {
  vmeId: string;
  boekjaarId: string;
  categorie: string;
}) {
  return (
    <ActionForm
      action={uploadDocumenten}
      resetOnSuccess
      hiddenFields={{ vme_id: vmeId, boekjaar_id: boekjaarId, categorie }}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3"
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor={`bewijs-${categorie}`}>
          Bewijsstuk uploaden (factuur / tariefblad)
        </label>
        <input
          id={`bewijs-${categorie}`}
          name="bestanden"
          type="file"
          accept=".pdf,image/*"
          className="block text-sm"
        />
      </div>
      <SubmitButton variant="outline" size="sm">
        Uploaden
      </SubmitButton>
    </ActionForm>
  );
}

export interface WaterWaarden {
  basisvolume: string;
  basis: string;
  comfort: string;
}

/**
 * Berekening van basisvolume, basis- en comforttarief van De Watergroep.
 * "Toepassen" zet de uitkomst in het formulier; opslaan doe je daar.
 */
export function WaterPrijsberekening({
  vmeId,
  boekjaarId,
  onToepassen,
}: {
  vmeId: string;
  boekjaarId: string;
  onToepassen: (w: WaterWaarden) => void;
}) {
  const [open, setOpen] = useState(false);
  const [drink, setDrink] = useState("");
  const [afvoer, setAfvoer] = useState("");
  const [zuivering, setZuivering] = useState("");
  const [btw, setBtw] = useState("6");
  const [personen, setPersonen] = useState("");
  const [aansluitingen, setAansluitingen] = useState("1");

  const exBtw = num(drink) + num(afvoer) + num(zuivering);
  const basis = exBtw > 0 ? r4(exBtw * (1 + num(btw) / 100)) : null;
  const comfort = basis != null ? r4(basis * 2) : null;
  const volume =
    personen.trim() !== ""
      ? 30 * Math.floor(num(aansluitingen)) + 30 * Math.floor(num(personen))
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Calculator className="size-3.5" /> Details prijsberekening
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Water: basisvolume en tarieven</DialogTitle>
          <DialogDescription>
            Vul de tarieven van De Watergroep in (excl. btw). Het basistarief is
            drinkwater + afvoer + zuivering; het comforttarief is het dubbele.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field
            label="Drinkwater (€/m³)"
            name="calc_drink"
            inputMode="decimal"
            value={drink}
            onChange={(e) => setDrink(e.target.value)}
            placeholder="2,9251"
          />
          <Field
            label="Afvoer (€/m³)"
            name="calc_afvoer"
            inputMode="decimal"
            value={afvoer}
            onChange={(e) => setAfvoer(e.target.value)}
            hint="Hangt af van de gemeente."
          />
          <Field
            label="Zuivering (€/m³)"
            name="calc_zuivering"
            inputMode="decimal"
            value={zuivering}
            onChange={(e) => setZuivering(e.target.value)}
            placeholder="1,7019"
          />
          <Field
            label="Btw (%)"
            name="calc_btw"
            inputMode="decimal"
            value={btw}
            onChange={(e) => setBtw(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Aantal aansluitingen"
            name="calc_aansluitingen"
            inputMode="numeric"
            value={aansluitingen}
            onChange={(e) => setAansluitingen(e.target.value)}
            hint="30 m³ basisvolume per aansluiting."
          />
          <Field
            label="Aantal gedomicilieerden"
            name="calc_personen"
            inputMode="numeric"
            value={personen}
            onChange={(e) => setPersonen(e.target.value)}
            hint="30 m³ basisvolume per gedomicilieerde."
            placeholder="bv. 8"
          />
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p>
            Basistarief:{" "}
            <strong>{basis != null ? `${basis.toFixed(4)} €/m³` : "—"}</strong>{" "}
            · Comforttarief:{" "}
            <strong>
              {comfort != null ? `${comfort.toFixed(4)} €/m³` : "—"}
            </strong>{" "}
            · Basisvolume:{" "}
            <strong>{volume != null ? `${volume} m³` : "—"}</strong>
          </p>
          {exBtw > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              ({num(drink)} + {num(afvoer)} + {num(zuivering)}) × {1 + num(btw) / 100}
            </p>
          )}
        </div>

        <Button
          type="button"
          disabled={basis == null && volume == null}
          onClick={() => {
            onToepassen({
              basisvolume: volume != null ? String(volume) : "",
              basis: basis != null ? String(basis) : "",
              comfort: comfort != null ? String(comfort) : "",
            });
            setOpen(false);
          }}
        >
          Toepassen in het formulier
        </Button>
        <p className="text-xs text-muted-foreground">
          Daarna klik je in het formulier op Opslaan.
        </p>

        <BewijsUpload vmeId={vmeId} boekjaarId={boekjaarId} categorie="tarief water" />
      </DialogContent>
    </Dialog>
  );
}

export interface LeveringRij {
  id: string;
  datum: string;
  leverancier: string | null;
  liter: number;
  prijs_per_liter: number;
  bedrag: number | null;
}

/** Mazoutleveringen van het boekjaar met het gewogen gemiddelde. */
export function MazoutPrijsberekening({
  vmeId,
  boekjaarId,
  leveringen,
}: {
  vmeId: string;
  boekjaarId: string;
  leveringen: LeveringRij[];
}) {
  const [open, setOpen] = useState(false);
  const totaalLiter = leveringen.reduce((s, l) => s + Number(l.liter), 0);
  const totaalBedrag = leveringen.reduce(
    (s, l) =>
      s + (l.bedrag != null ? Number(l.bedrag) : Number(l.liter) * Number(l.prijs_per_liter)),
    0,
  );
  const gewogen = totaalLiter > 0 ? totaalBedrag / totaalLiter : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Calculator className="size-3.5" /> Details prijsberekening
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mazout: gemiddelde prijs per liter</DialogTitle>
          <DialogDescription>
            Gewogen gemiddelde van de leveringen in dit boekjaar: totaal bedrag ÷
            totaal aantal liter.
          </DialogDescription>
        </DialogHeader>

        {leveringen.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen leveringen in dit boekjaar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Leverancier</TableHead>
                <TableHead className="text-right">Liter</TableHead>
                <TableHead className="text-right">Prijs/l</TableHead>
                <TableHead className="text-right">Totaal</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leveringen.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{datum(l.datum)}</TableCell>
                  <TableCell>{l.leverancier ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(l.liter).toLocaleString("nl-BE")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(l.prijs_per_liter)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(
                      l.bedrag != null
                        ? Number(l.bedrag)
                        : Number(l.liter) * Number(l.prijs_per_liter),
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionForm action={deleteMazout} hiddenFields={{ id: l.id }}>
                      <ConfirmSubmit message="Levering verwijderen?" />
                    </ActionForm>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell colSpan={2}>Totaal / gewogen gemiddelde</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totaalLiter.toLocaleString("nl-BE")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {gewogen != null ? `€ ${gewogen.toFixed(4)}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {euro(totaalBedrag)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}

        <ActionForm
          action={createMazout}
          resetOnSuccess
          hiddenFields={{ vme_id: vmeId }}
          className="flex flex-wrap items-end gap-3 rounded-md border p-3"
        >
          <Field label="Datum" name="datum" type="date" required />
          <Field label="Liter" name="liter" inputMode="decimal" required />
          <Field label="Prijs/liter" name="prijs_per_liter" inputMode="decimal" />
          <Field label="of totaal (€)" name="bedrag" inputMode="decimal" />
          <Field label="Leverancier" name="leverancier" />
          <SubmitButton size="sm">Levering toevoegen</SubmitButton>
        </ActionForm>

        <ActionForm
          action={mazoutprijsUitLeveringen}
          hiddenFields={{ vme_id: vmeId, boekjaar_id: boekjaarId }}
        >
          <SubmitButton>
            Gemiddelde berekenen en opslaan als mazoutprijs
          </SubmitButton>
        </ActionForm>

        <BewijsUpload vmeId={vmeId} boekjaarId={boekjaarId} categorie="factuur mazout" />
      </DialogContent>
    </Dialog>
  );
}
