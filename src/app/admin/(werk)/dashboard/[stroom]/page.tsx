import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import { opbrengstenNaarRijen } from "@/lib/financien";
import { hoortBijBoekjaar } from "@/lib/boekjaar-transacties";
import { NoBoekjaar } from "@/components/no-boekjaar";
import {
  FinancieleTabel,
  type FinancieleRij,
} from "@/components/financiele-tabel";
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

const UIT_LABEL: Record<string, string> = {
  terugbetaling: "Terugbetalingen",
  afrekening: "Betaalde afrekeningen",
  overig: "Overige uitgaven",
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
  const boekjaar = (bj && boekjaren.find((b) => b.id === bj)) || actief;
  const anderBoekjaar = boekjaar.id !== actief.id;
  const jaar = Number(boekjaar.start_datum.slice(0, 4));
  const andereRekening = cfg.rekening === "spaar" ? "zichtrekening" : "spaarrekening";

  // Altijd bank-basis (transacties), zodat dit exact aansluit op de
  // dashboardkaart van dezelfde rekening (spec §24 — één bron van waarheid).
  const { data: txAlle } = await db
    .from("transactie")
    .select("*")
    .eq("vme_id", vme.id)
    .eq("rekening", cfg.rekening)
    .gte("datum", `${jaar - 1}-01-01`)
    .returns<Transactie[]>();
  const tx = (txAlle ?? []).filter((t) => hoortBijBoekjaar(t, boekjaar));

  const groepen: { naam: string; rijen: FinancieleRij[] }[] = [];

  const duwIn = (m: Map<string, FinancieleRij[]>, k: string, r: FinancieleRij) => {
    const l = m.get(k);
    if (l) l.push(r);
    else m.set(k, [r]);
  };

  if (cfg.richting === "in") {
    const rijen = opbrengstenNaarRijen(tx, boekjaar, cfg.rekening);
    const per = new Map<string, FinancieleRij[]>();
    for (const r of rijen) duwIn(per, r.omschrijving.split(" — ")[0], r);
    for (const [naam, rs] of [...per].sort()) groepen.push({ naam, rijen: rs });
  } else {
    // Categorie van de gekoppelde kost erbij, voor een nettere groepering.
    const { data: kostenRows } = await db
      .from("kosten")
      .select("betaald_met_transactie_id, categorie")
      .eq("boekjaar_id", boekjaar.id)
      .returns<Pick<Kosten, "betaald_met_transactie_id" | "categorie">[]>();
    const catVanTx = new Map(
      (kostenRows ?? [])
        .filter((k) => k.betaald_met_transactie_id)
        .map((k) => [k.betaald_met_transactie_id as string, k.categorie]),
    );

    const per = new Map<string, FinancieleRij[]>();
    for (const t of tx) {
      if (Number(t.bedrag) >= 0) continue;
      const cat = catVanTx.get(t.id) ?? null;
      const naam =
        t.soort === "interne_overboeking"
          ? `Overboeking naar de ${andereRekening}`
          : t.soort === "kost"
            ? (cat ?? "Betalingen aan leveranciers")
            : (UIT_LABEL[t.soort] ?? t.soort);
      const rij: FinancieleRij = {
        id: t.id,
        datum: t.datum,
        omschrijving:
          t.mededeling ?? t.tegenpartij_naam ?? t.soort.replace(/_/g, " "),
        tegenpartij: t.tegenpartij_naam,
        categorie: cat,
        rekening: t.rekening,
        bedrag: Number(t.bedrag),
        href: `/admin/financien/transactie/${t.id}`,
      };
      duwIn(per, naam, rij);
    }
    for (const [naam, rs] of [...per].sort(([a], [b]) => a.localeCompare(b))) {
      rs.sort((x, y) => y.datum.localeCompare(x.datum));
      groepen.push({ naam, rijen: rs });
    }
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
