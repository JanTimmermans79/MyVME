"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import {
  leesOpnameDatum,
  leesTeller,
  matchTeller,
  type OcrResultaat,
} from "@/lib/meterfoto-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bewaarMeterfoto } from "@/app/admin/(werk)/meterstanden/actions";
import { dienMeteropnameIn } from "@/app/dashboard/actions";

const TYPE_LABEL: Record<string, string> = {
  koud_water: "Koud water",
  warm_water: "Warm water",
  cv: "CV / verwarming",
};

interface TellerKeuze {
  id: string;
  type: string;
  meternummer: string | null;
}

/**
 * Foto van een teller uploaden (of met de gsm nemen). EXIF geeft de datum,
 * lokale OCR een voorstel voor waarde + meternummer. De gebruiker controleert
 * alles naast de foto en verstuurt:
 *  - syndicus  → de opname komt in de inbox "Foto-opnames" om te bevestigen;
 *  - eigenaar  → de opname wacht op bevestiging door de syndicus.
 */
export function MeterfotoUpload({
  rol,
  vmeId,
  unitId,
  unitNaam,
  boekjaarId,
  tellers,
}: {
  rol: "syndicus" | "eigenaar";
  vmeId: string;
  unitId: string;
  unitNaam: string;
  boekjaarId?: string;
  tellers: TellerKeuze[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [leest, startLees] = useTransition();
  const [verzendt, startVerzend] = useTransition();
  const [over, setOver] = useState(false);
  const [concept, setConcept] = useState<{
    file: File;
    previewUrl: string;
    ocr: OcrResultaat;
  } | null>(null);
  const [tellerId, setTellerId] = useState("");
  const [datum, setDatum] = useState("");
  const [waarde, setWaarde] = useState("");

  const verwerk = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Kies een foto (afbeelding) van de teller.");
      return;
    }
    startLees(async () => {
      const [d, ocr] = await Promise.all([
        leesOpnameDatum(file),
        leesTeller(file),
      ]);
      setConcept({ file, previewUrl: URL.createObjectURL(file), ocr });
      setTellerId(
        matchTeller(ocr.meternummer, tellers) ??
          (tellers.length === 1 ? tellers[0].id : ""),
      );
      setDatum(d ?? new Date().toISOString().slice(0, 10));
      setWaarde(ocr.waarde != null ? String(ocr.waarde) : "");
    });
  };

  const sluit = () => {
    if (concept) URL.revokeObjectURL(concept.previewUrl);
    setConcept(null);
  };

  const verzend = () => {
    if (!concept) return;
    if (!tellerId) {
      toast.error("Kies welke teller op de foto staat.");
      return;
    }
    if (!waarde.trim()) {
      toast.error("Vul de meterstand in.");
      return;
    }
    const fd = new FormData();
    fd.set("file", concept.file);
    fd.set("vme_id", vmeId);
    fd.set("unit_id", unitId);
    if (boekjaarId) fd.set("boekjaar_id", boekjaarId);
    fd.set("teller_id", tellerId);
    if (datum) fd.set("opname_datum", datum);
    fd.set("herkende_waarde", waarde.trim());
    if (concept.ocr.meternummer)
      fd.set("herkend_meternummer", concept.ocr.meternummer);

    startVerzend(async () => {
      const r =
        rol === "syndicus"
          ? await bewaarMeterfoto(fd)
          : await dienMeteropnameIn(fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        rol === "syndicus"
          ? "Foto opgeslagen — bevestig ze onder “Foto-opnames”."
          : "Ingediend. De syndicus bevestigt je opname.",
      );
      sluit();
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) verwerk(file);
        }}
        disabled={leest}
        className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-sm transition-colors ${
          over ? "border-primary bg-primary/5" : "border-input"
        } ${leest ? "opacity-60" : "hover:border-primary/60"}`}
      >
        <Camera className="size-5 text-muted-foreground" />
        {leest ? (
          <span>Foto lezen… (dit kan even duren)</span>
        ) : (
          <>
            <span className="font-medium">Foto van een teller toevoegen</span>
            <span className="text-xs text-muted-foreground">
              Neem een foto met je gsm of sleep er een op. Datum en waarde worden
              zo goed mogelijk herkend — je controleert alles zelf.
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) verwerk(file);
          e.target.value = "";
        }}
      />

      <Dialog open={concept != null} onOpenChange={(o) => !o && sluit()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Meterstand van foto — {unitNaam}</DialogTitle>
          </DialogHeader>
          {concept && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={concept.previewUrl}
                alt="Tellerfoto"
                className="max-h-56 w-full rounded-md border object-contain"
              />
              <p className="rounded-md bg-amber-500/10 p-2 text-xs">
                Automatisch herkend uit de foto — vaak niet exact.{" "}
                <strong>Controleer en corrigeer</strong> vóór je verstuurt.
              </p>

              <div className="space-y-1.5">
                <Label>Welke teller?</Label>
                <Select value={tellerId} onValueChange={setTellerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="(kies teller)" />
                  </SelectTrigger>
                  <SelectContent>
                    {tellers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {TYPE_LABEL[t.type] ?? t.type}
                        {t.meternummer ? ` · nr. ${t.meternummer}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {concept.ocr.meternummer && (
                  <p className="text-xs text-muted-foreground">
                    Herkend meternummer: {concept.ocr.meternummer}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mf-datum">Opnamedatum</Label>
                  <Input
                    id="mf-datum"
                    type="date"
                    value={datum}
                    onChange={(e) => setDatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mf-waarde">Meterstand (m³)</Label>
                  <Input
                    id="mf-waarde"
                    inputMode="decimal"
                    value={waarde}
                    onChange={(e) => setWaarde(e.target.value)}
                  />
                </div>
              </div>

              {concept.ocr.ruweTekst && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Ruwe OCR-tekst</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words">
                    {concept.ocr.ruweTekst}
                  </pre>
                </details>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={sluit}
              disabled={verzendt}
            >
              Annuleren
            </Button>
            <Button type="button" onClick={verzend} disabled={verzendt}>
              {verzendt
                ? "Bezig…"
                : rol === "syndicus"
                  ? "Opslaan in inbox"
                  : "Indienen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Meterstand handmatig ingeven (geen foto). Eigenaarskant — de opname belandt
 * ook in de inbox van de syndicus en wordt pas een echte meterstand na
 * bevestiging.
 */
export function ManueleOpnameDialog({
  unitId,
  unitNaam,
  vmeId,
  boekjaarId,
  tellers,
}: {
  unitId: string;
  unitNaam: string;
  vmeId: string;
  boekjaarId?: string;
  tellers: TellerKeuze[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [verzendt, start] = useTransition();
  const [tellerId, setTellerId] = useState(
    tellers.length === 1 ? tellers[0].id : "",
  );
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [waarde, setWaarde] = useState("");

  const verzend = () => {
    if (!tellerId) return toast.error("Kies de teller.");
    if (!datum) return toast.error("Vul de datum in.");
    if (!waarde.trim()) return toast.error("Vul de meterstand in.");
    const fd = new FormData();
    fd.set("vme_id", vmeId);
    fd.set("unit_id", unitId);
    if (boekjaarId) fd.set("boekjaar_id", boekjaarId);
    fd.set("teller_id", tellerId);
    fd.set("opname_datum", datum);
    fd.set("herkende_waarde", waarde.trim());
    start(async () => {
      const r = await dienMeteropnameIn(fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Ingediend. De syndicus bevestigt je opname.");
      setOpen(false);
      setWaarde("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Handmatig invoeren
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meterstand invoeren — {unitNaam}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Teller</Label>
            <Select value={tellerId} onValueChange={setTellerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(kies teller)" />
              </SelectTrigger>
              <SelectContent>
                {tellers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {TYPE_LABEL[t.type] ?? t.type}
                    {t.meternummer ? ` · nr. ${t.meternummer}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mo-datum">Datum</Label>
              <Input
                id="mo-datum"
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo-waarde">Meterstand (m³)</Label>
              <Input
                id="mo-waarde"
                inputMode="decimal"
                value={waarde}
                onChange={(e) => setWaarde(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Je opname wordt pas een officiële meterstand nadat de syndicus ze
            nakijkt.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={verzendt}
          >
            Annuleren
          </Button>
          <Button type="button" onClick={verzend} disabled={verzendt}>
            {verzendt ? "Bezig…" : "Indienen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
