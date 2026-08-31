import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { opbrengstenNaarRijen } from "@/lib/financien";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { FinancieleTabel } from "@/components/financiele-tabel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Transactie, VmeRekening } from "@/lib/types";

export async function OpbrengstenView({ rekening }: { rekening: VmeRekening }) {
  const { vme, boekjaar } = await getActiveContext();
  if (!vme || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();
  const jaarStart = boekjaar.start_datum.slice(0, 4);
  // ruim ophalen (boekjaar_id kan expliciet of via datum), daarna filteren
  const { data: tx } = await supabase
    .from("transactie")
    .select("*")
    .eq("vme_id", vme.id)
    .eq("rekening", rekening)
    .gt("bedrag", 0)
    .gte("datum", `${Number(jaarStart) - 1}-01-01`)
    .returns<Transactie[]>();

  const rijen = opbrengstenNaarRijen(tx ?? [], boekjaar, rekening);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Opbrengsten {rekening}rekening
        </CardTitle>
        <CardDescription>
          Alle inkomende verrichtingen op de {rekening}rekening die bij dit
          boekjaar horen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FinancieleTabel
          rijen={rijen}
          toonRekening={false}
          totaalLabel="Totaal opbrengsten"
          legeTekst="Geen opbrengsten op deze rekening dit boekjaar."
        />
      </CardContent>
    </Card>
  );
}
