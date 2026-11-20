import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { actieveCategorieNamen } from "@/lib/categorie";
import { rekeningVanKost } from "@/lib/financien";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { laadHerverdelingInfo } from "@/lib/herverdeling";
import { NoBoekjaar } from "@/components/no-boekjaar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Kosten, Verdeelsleutel, VmeRekening } from "@/lib/types";
import { KostenLijst } from "./kosten/kosten-lijst";
import { KostenBeheer } from "./kosten/kosten-beheer";
import { HerverdelingKaart } from "./kosten/herverdeling-kaart";

const EIGENAAR_VERDELING = new Set(["gelijk_eigenaars", "per_quotiteit"]);

/**
 * Kostenlijst. Per rekening (zicht/spaar), of per groep: alle kosten die aan de
 * huurders of aan de eigenaars worden doorgerekend, ongeacht de rekening.
 */
export async function KostenView({
  rekening: rekeningProp,
  groep,
}: {
  rekening?: VmeRekening;
  groep?: "huurders" | "eigenaars";
}) {
  const rekening: VmeRekening = rekeningProp ?? "zicht";
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

  // Herverdeling van extra waterverbruik (besluit algemene vergadering).
  const herverdeling =
    rekening === "zicht" && groep !== "eigenaars"
      ? await (async () => {
          await requireAdmin();
          const info = await laadHerverdelingInfo(
            createAdminClient(),
            vme.id,
            boekjaar.id,
            "koud water",
          );
          return info.facturen > 0 || info.actief ? info : null;
        })()
      : null;

  const kosten = (alleKosten ?? []).filter((k) =>
    groep
      ? groep === "eigenaars"
        ? EIGENAAR_VERDELING.has(k.verdeling)
        : !EIGENAAR_VERDELING.has(k.verdeling)
      : rekeningVanKost(k) === rekening,
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
      {herverdeling && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Herverdeling extra waterverbruik (besluit AV)
            </CardTitle>
            <CardDescription>
              Het extra stadswaterverbruik (bv. defecte regenwaterpomp) valt
              niet onder de tellers. Verdeel het hier volgens het besluit van de
              algemene vergadering; je kan het later aanpassen of verwijderen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HerverdelingKaart
              key={herverdeling.actief?.bedrag ?? "nieuw"}
              vmeId={vme.id}
              boekjaarId={boekjaar.id}
              info={herverdeling}
            />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {groep === "huurders"
              ? "Onkosten huurders"
              : groep === "eigenaars"
                ? "Onkosten eigenaars"
                : `Kosten ${rekening}rekening`}{" "}
            ({kosten.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KostenLijst
            kosten={kosten}
            boekjaren={boekjaren}
            verdeelsleutels={sleutels ?? []}
            categorieen={categorieen}
            toonRekening={groep != null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
