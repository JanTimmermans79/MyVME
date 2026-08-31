import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { actieveCategorieNamen } from "@/lib/categorie";
import { rekeningVanKost } from "@/lib/financien";
import { NoBoekjaar } from "@/components/no-boekjaar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Kosten, Verdeelsleutel, VmeRekening } from "@/lib/types";
import { KostenLijst } from "./kosten/kosten-lijst";
import { KostenBeheer } from "./kosten/kosten-beheer";

export async function KostenView({ rekening }: { rekening: VmeRekening }) {
  const { vme, boekjaar, boekjaren } = await getActiveContext();
  if (!vme || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();
  const [{ data: sleutels }, { data: alleKosten }, categorieen] =
    await Promise.all([
      supabase
        .from("verdeelsleutel")
        .select("*")
        .eq("vme_id", vme.id)
        .order("naam")
        .returns<Verdeelsleutel[]>(),
      supabase
        .from("kosten")
        .select("*")
        .eq("boekjaar_id", boekjaar.id)
        .order("datum", { ascending: false })
        .returns<Kosten[]>(),
      actieveCategorieNamen(supabase, vme.id),
    ]);

  const kosten = (alleKosten ?? []).filter(
    (k) => rekeningVanKost(k) === rekening,
  );

  return (
    <div className="space-y-5">
      <KostenBeheer
        vmeId={vme.id}
        rekening={rekening}
        boekjaren={boekjaren}
        verdeelsleutels={sleutels ?? []}
        categorieen={categorieen}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Kosten {rekening}rekening ({kosten.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KostenLijst
            kosten={kosten}
            boekjaren={boekjaren}
            verdeelsleutels={sleutels ?? []}
            categorieen={categorieen}
          />
        </CardContent>
      </Card>
    </div>
  );
}
