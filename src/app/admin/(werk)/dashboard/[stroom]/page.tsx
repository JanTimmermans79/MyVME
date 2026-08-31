import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import {
  kostenNaarRijen,
  opbrengstenNaarRijen,
  rekeningVanKost,
} from "@/lib/financien";
import { hoortBijBoekjaar } from "@/lib/boekjaar-transacties";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { FinancieleTabel } from "@/components/financiele-tabel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Kosten, Transactie, VmeRekening } from "@/lib/types";

export const metadata = { title: "Detail" };

const STROMEN: Record<
  string,
  { rekening: VmeRekening; richting: "in" | "uit"; titel: string }
> = {
  "zicht-in": { rekening: "zicht", richting: "in", titel: "Inkomsten zichtrekening" },
  "zicht-uit": { rekening: "zicht", richting: "uit", titel: "Uitgaven zichtrekening" },
  "spaar-in": { rekening: "spaar", richting: "in", titel: "Inkomsten spaarrekening" },
  "spaar-uit": { rekening: "spaar", richting: "uit", titel: "Uitgaven spaarrekening" },
};

export default async function DrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ stroom: string }>;
  searchParams: Promise<{ bj?: string }>;
}) {
  const { stroom } = await params;
  const { bj } = await searchParams;
  const cfg = STROMEN[stroom];
  if (!cfg) notFound();

  const { vme, boekjaar: actief, boekjaren } = await getActiveContext();
  if (!vme || !actief) return <NoBoekjaar />;
  const db = createAdminClient();

  // ?bj= laat toe een ander boekjaar te bekijken (vanuit de evolutiegrafiek).
  const boekjaar =
    (bj && boekjaren.find((b) => b.id === bj)) || actief;
  const anderBoekjaar = boekjaar.id !== actief.id;

  const groepen: { naam: string; rijen: ReturnType<typeof kostenNaarRijen> }[] = [];

  if (cfg.richting === "uit") {
    const { data: alle } = await db
      .from("kosten")
      .select("*")
      .eq("boekjaar_id", boekjaar.id)
      .order("datum", { ascending: false })
      .returns<Kosten[]>();
    const kosten = (alle ?? []).filter((k) => rekeningVanKost(k) === cfg.rekening);
    const perCat = new Map<string, Kosten[]>();
    for (const k of kosten) {
      const l = perCat.get(k.categorie) ?? [];
      l.push(k);
      perCat.set(k.categorie, l);
    }
    for (const [naam, ks] of [...perCat].sort())
      groepen.push({ naam, rijen: kostenNaarRijen(ks) });
  } else {
    const jaar = Number(boekjaar.start_datum.slice(0, 4));
    const { data: tx } = await db
      .from("transactie")
      .select("*")
      .eq("vme_id", vme.id)
      .eq("rekening", cfg.rekening)
      .gt("bedrag", 0)
      .gte("datum", `${jaar - 1}-01-01`)
      .returns<Transactie[]>();
    const rijen = opbrengstenNaarRijen(
      (tx ?? []).filter((t) => hoortBijBoekjaar(t, boekjaar)),
      boekjaar,
      cfg.rekening,
    );
    const perSoort = new Map<string, typeof rijen>();
    for (const r of rijen) {
      const l = perSoort.get(r.omschrijving.split(" — ")[0]) ?? [];
      l.push(r);
      perSoort.set(r.omschrijving.split(" — ")[0], l);
    }
    for (const [naam, rs] of [...perSoort].sort())
      groepen.push({ naam, rijen: rs });
  }

  const totaal = groepen.reduce(
    (s, g) => s + g.rijen.reduce((x, r) => x + r.bedrag, 0),
    0,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Terug naar dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{cfg.titel}</h1>
        <p className="text-sm text-muted-foreground">
          Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}
          {anderBoekjaar && " (ander dan het actieve boekjaar)"} · totaal{" "}
          <strong>{euro(totaal)}</strong>
        </p>
      </div>

      {groepen.length === 0 ? (
        <p className="text-sm text-muted-foreground">Geen verrichtingen.</p>
      ) : (
        groepen.map((g) => (
          <Card key={g.naam}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base capitalize">
                {g.naam}
                <span className="tabular-nums text-sm">
                  {euro(g.rijen.reduce((s, r) => s + r.bedrag, 0))}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FinancieleTabel
                rijen={g.rijen}
                toonRekening={false}
                totaalLabel={`Totaal ${g.naam}`}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
