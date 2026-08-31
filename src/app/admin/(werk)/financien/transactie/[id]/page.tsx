import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { euro, datum } from "@/lib/format";
import type { Boekjaar, Kosten, Transactie, Unit } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SoortSelect } from "../../bank/soort-select";
import { BoekjaarSelect } from "../../bank/boekjaar-select";
import { AssignRow } from "../../bank/assign-row";

export const metadata = { title: "Transactie" };

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function TransactieDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();

  const { data: t } = await db
    .from("transactie")
    .select("*")
    .eq("id", id)
    .maybeSingle<Transactie>();
  if (!t) notFound();

  const [{ data: units }, { data: boekjaren }, { data: kost }, docRes] =
    await Promise.all([
      db.from("unit").select("*").eq("vme_id", t.vme_id).order("naam").returns<Unit[]>(),
      db
        .from("boekjaar")
        .select("*")
        .eq("vme_id", t.vme_id)
        .order("start_datum", { ascending: false })
        .returns<Boekjaar[]>(),
      db
        .from("kosten")
        .select("*")
        .eq("betaald_met_transactie_id", t.id)
        .maybeSingle<Kosten>(),
      db.from("document").select("id, naam").eq("transactie_id", t.id),
    ]);
  const documenten = (docRes.data ?? []) as { id: string; naam: string }[];
  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));

  return (
    <div className="space-y-5">
      <Link
        href="/admin/financien/bank"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Terug
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-baseline gap-3">
            <span className="tabular-nums">{euro(t.bedrag)}</span>
            <Badge variant="outline" className="capitalize">
              {t.rekening ?? "?"}rekening
            </Badge>
            <Badge variant="secondary">{t.soort.replace(/_/g, " ")}</Badge>
          </CardTitle>
          <CardDescription>
            {datum(t.datum)} · {t.tegenpartij_naam ?? "geen tegenpartij"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Veld label="Tegenpartij">{t.tegenpartij_naam ?? "—"}</Veld>
          <Veld label="IBAN tegenpartij">
            <span className="font-mono text-xs">{t.tegenpartij_iban ?? "—"}</span>
          </Veld>
          <Veld label="Mededeling">{t.mededeling ?? "—"}</Veld>
          <Veld label="Bron">{t.bron}</Veld>
          <Veld label="Match">{t.match_type ?? "—"}</Veld>
          <Veld label="Toegewezen aan">
            {t.gematchte_unit_id
              ? `${unitNaam.get(t.gematchte_unit_id) ?? "—"} (${t.betaler_type ?? "?"})`
              : "—"}
          </Veld>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classificatie aanpassen</CardTitle>
          <CardDescription>
            Een individuele correctie hier wijzigt de leveranciersconfiguratie
            niet (§14).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Soort</span>
            <SoortSelect id={t.id} waarde={t.soort} />
            <span className="text-muted-foreground">Boekjaar</span>
            <BoekjaarSelect
              id={t.id}
              waarde={t.boekjaar_id}
              boekjaren={boekjaren ?? []}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Toewijzen</span>
            <AssignRow transactieId={t.id} units={units ?? []} />
          </div>
        </CardContent>
      </Card>

      {kost && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gekoppelde kost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Veld label="Categorie">{kost.categorie}</Veld>
            <Veld label="Verdeling">{kost.verdeling.replace(/_/g, " ")}</Veld>
            <Veld label="Bedrag">{euro(kost.bedrag)}</Veld>
            <Veld label="Status">{kost.status}</Veld>
            <Link
              href={`/admin/financien/kost/${kost.id}`}
              className="inline-block text-sm underline"
            >
              Naar de kost →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Gekoppelde documenten ({documenten.length})
          </CardTitle>
          <CardDescription>
            Koppel een factuur via Documenten → uploaden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documenten.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen document gekoppeld.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {documenten.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/documenten/download?id=${d.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 underline"
                  >
                    <FileText className="size-4" /> {d.naam}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
