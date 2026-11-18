import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
import type { Eenheidsprijs } from "@/lib/types";
import { TarievenForm } from "./tarieven-form";

export const metadata = { title: "Tarieven & parameters" };

export default async function TarievenPage() {
  const { vme, boekjaar, boekjaren } = await getActiveContext();
  if (!vme || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();
  const { data: rijen } = await supabase
    .from("eenheidsprijs")
    .select("*")
    .eq("vme_id", vme.id)
    .returns<Eenheidsprijs[]>();
  const perBoekjaar = new Map((rijen ?? []).map((r) => [r.boekjaar_id, r]));
  const huidig = perBoekjaar.get(boekjaar.id) ?? null;

  // Nog niets ingesteld voor dit boekjaar: voorstel uit het meest recente
  // eerdere boekjaar (tarieven en volumes wijzigen per jaar; er wordt niets
  // bewaard tot je op Opslaan klikt).
  let voorstelVan: (typeof boekjaren)[number] | null = null;
  let voorstel: Eenheidsprijs | null = null;
  if (!huidig) {
    const eerder = [...boekjaren]
      .filter(
        (b) => b.start_datum < boekjaar.start_datum && perBoekjaar.has(b.id),
      )
      .sort((a, b) => b.start_datum.localeCompare(a.start_datum))[0];
    if (eerder) {
      voorstelVan = eerder;
      voorstel = perBoekjaar.get(eerder.id) ?? null;
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/instellingen"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> Instellingen
        </Link>
        <h1 className="text-xl font-semibold">Tarieven &amp; parameters</h1>
        <p className="text-sm text-muted-foreground">
          Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}.
          Tarieven, basisvolume en het doorgerekende percentage hangen af van het
          jaar en van de samenstelling van de gezinnen; kies bovenaan een ander
          boekjaar om dat jaar aan te passen.
        </p>
      </div>

      {voorstelVan && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Voor dit boekjaar is nog niets opgeslagen. De waarden hieronder zijn een
          voorstel uit het boekjaar {datum(voorstelVan.start_datum)} –{" "}
          {datum(voorstelVan.eind_datum)}: pas ze aan en klik op Opslaan.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarieven &amp; parameters</CardTitle>
          <CardDescription>
            Gebruikt in de meterstanden-overzichten en in de huurders- en
            eigenaarsafrekening van dit boekjaar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TarievenForm
            key={boekjaar.id}
            vmeId={vme.id}
            boekjaarId={boekjaar.id}
            huidig={huidig ?? voorstel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
