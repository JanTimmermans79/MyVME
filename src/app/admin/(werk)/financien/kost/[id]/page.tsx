import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { euro, datum } from "@/lib/format";
import { actieveCategorieNamen } from "@/lib/categorie";
import { rekeningVanKost } from "@/lib/financien";
import { createClient } from "@/lib/supabase/server";
import type {
  Boekjaar,
  Kosten,
  Transactie,
  Unit,
  Verdeelsleutel,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  EditKostDialog,
  ConfirmKostButton,
  DeleteKostButton,
} from "../../kosten/kosten-forms";

export const metadata = { title: "Kost" };

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function KostDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();

  const { data: k } = await db
    .from("kosten")
    .select("*")
    .eq("id", id)
    .maybeSingle<Kosten>();
  if (!k) notFound();

  const [{ data: boekjaren }, { data: sleutels }, { data: units }, { data: tx }] =
    await Promise.all([
      db.from("boekjaar").select("*").eq("vme_id", k.vme_id).order("start_datum", { ascending: false }).returns<Boekjaar[]>(),
      db.from("verdeelsleutel").select("*").eq("vme_id", k.vme_id).order("naam").returns<Verdeelsleutel[]>(),
      db.from("unit").select("*").eq("vme_id", k.vme_id).order("naam").returns<Unit[]>(),
      k.betaald_met_transactie_id
        ? db.from("transactie").select("*").eq("id", k.betaald_met_transactie_id).maybeSingle<Transactie>()
        : Promise.resolve({ data: null }),
    ]);
  const categorieen = await actieveCategorieNamen(await createClient(), k.vme_id);

  const rekening = rekeningVanKost(k);
  const nUnits = Math.max(1, (units ?? []).length);
  const sleutelNaam = (sleutels ?? []).find((s) => s.id === k.verdeelsleutel_id)?.naam;

  let impact = "";
  if (k.verdeling === "individueel_verbruik")
    impact = "Verdeeld per appartement volgens de meterstanden.";
  else if (k.verdeling === "gelijk_huurders")
    impact = `Gelijk over ${nUnits} appartementen (huurders): ${euro(Math.abs(k.bedrag) / nUnits)} per appartement (pro rata dagen).`;
  else if (k.verdeling === "gelijk_eigenaars")
    impact = `Gelijk over ${nUnits} appartementen (eigenaars): ${euro(Math.abs(k.bedrag) / nUnits)} per appartement.`;
  else if (k.verdeling === "per_quotiteit")
    impact = sleutelNaam
      ? `Per quotiteit via verdeelsleutel "${sleutelNaam}".`
      : "Per quotiteit — verdeelsleutel nog niet toegewezen.";

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/financien/${rekening}/kosten`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Terug naar kosten {rekening}rekening
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex flex-wrap items-baseline gap-3">
              <span className="capitalize">{k.categorie}</span>
              <span className="tabular-nums">{euro(k.bedrag)}</span>
              <Badge variant={k.status === "bevestigd" ? "secondary" : "outline"}>
                {k.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {datum(k.datum)} · {k.leverancier ?? "geen leverancier"} ·{" "}
              {rekening}rekening
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {k.status === "voorstel" && <ConfirmKostButton id={k.id} />}
            <EditKostDialog
              kost={k}
              boekjaren={boekjaren ?? []}
              verdeelsleutels={sleutels ?? []}
              categorieen={categorieen}
            />
            <DeleteKostButton id={k.id} />
          </div>
        </CardHeader>
        <CardContent>
          <Veld label="Bedrag">{euro(k.bedrag)}</Veld>
          <Veld label="Datum">{datum(k.datum)}</Veld>
          <Veld label="Categorie">{k.categorie}</Veld>
          <Veld label="Rekening">{rekening}rekening</Veld>
          <Veld label="Toewijzing">{k.betaler_type}</Veld>
          <Veld label="Verdeling">{k.verdeling.replace(/_/g, " ")}</Veld>
          <Veld label="Verdeelsleutel">{sleutelNaam ?? "—"}</Veld>
          {k.omschrijving && <Veld label="Omschrijving">{k.omschrijving}</Veld>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verdeling in de afrekening</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{impact}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Herkomst</CardTitle>
          <CardDescription>De banktransactie waaruit deze kost komt.</CardDescription>
        </CardHeader>
        <CardContent>
          {tx ? (
            <Link
              href={`/admin/financien/transactie/${tx.id}`}
              className="text-sm underline"
            >
              {datum(tx.datum)} · {euro(tx.bedrag)} · {tx.tegenpartij_naam ?? "—"} →
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              Handmatig geboekt — geen gekoppelde transactie.
            </p>
          )}
          {k.document_url && (
            <p className="mt-2">
              <Link
                href={`/admin/financien/document?path=${encodeURIComponent(k.document_url)}`}
                target="_blank"
                className="text-sm underline"
              >
                Bewijsstuk openen
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
