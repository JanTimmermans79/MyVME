import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { NoVme } from "@/components/no-vme";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Categorie } from "@/lib/types";
import {
  CreateCategorieForm,
  CategorieRij,
  DeleteCategorieButton,
} from "./categorie-forms";

export const metadata = { title: "Categorieën" };

export default async function CategorieenPage() {
  const { vme } = await getActiveContext();
  if (!vme) return <NoVme />;

  const supabase = await createClient();
  const { data: cats, error } = await supabase
    .from("categorie")
    .select("*")
    .eq("vme_id", vme.id)
    .order("groep")
    .order("naam")
    .returns<Categorie[]>();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/instellingen"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> Instellingen
        </Link>
        <h1 className="text-xl font-semibold">Categorieën</h1>
        <p className="text-sm text-muted-foreground">
          Kosten- en opbrengstcategorieën. De groep bepaalt hoe een kost in de
          afrekening verschijnt: <strong>verbruik</strong> (via meterstand),{" "}
          <strong>divers</strong> (pro rata over de huurders) of{" "}
          <strong>eigenaarskost</strong>.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
          Tabel <code>categorie</code> bestaat nog niet — draai migratie{" "}
          <code>20260831120000</code> en <code>scripts/seed-categorieen.mjs</code>.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nieuwe categorie</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCategorieForm vmeId={vme.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Categorieën ({cats?.length ?? 0})
          </CardTitle>
          <CardDescription>
            Inactieve categorieën verdwijnen uit de keuzelijsten maar blijven op
            bestaande kosten staan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(cats ?? []).map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {c.groep}
                </Badge>
                <CategorieRij categorie={c} />
              </div>
              <DeleteCategorieButton id={c.id} />
            </div>
          ))}
          {(cats ?? []).length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Nog geen categorieën.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
