import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoVme } from "@/components/no-vme";
import { TerugLink } from "@/components/terug-link";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Actiepunt, ActiepuntStatus, Boekjaar } from "@/lib/types";
import { deleteActiepunt } from "./actions";
import {
  CreateActiepuntForm,
  EditActiepuntDialog,
  ImportActiepuntenDialog,
  ActiepuntStatusKnop,
  type DocKeuze,
} from "./actiepunt-forms";

export const metadata = { title: "Actiepunten" };

const STATUS_LABEL: Record<ActiepuntStatus, string> = {
  open: "Open",
  bezig: "Bezig",
  afgewerkt: "Afgewerkt",
};

const vandaag = () => new Date().toISOString().slice(0, 10);

export default async function ActiepuntenPage() {
  const { vme, boekjaar, boekjaren } = await getActiveContext();
  if (!vme) return <NoVme />;

  const supabase = await createClient();
  const [{ data: actieRows, error }, { data: docRows }] = await Promise.all([
    supabase
      .from("actiepunt")
      .select("*")
      .eq("vme_id", vme.id)
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<Actiepunt[]>(),
    supabase
      .from("document")
      .select("id, naam")
      .eq("vme_id", vme.id)
      .order("created_at", { ascending: false }),
  ]);

  const migratieNodig =
    error?.message?.toLowerCase().includes("actiepunt") ?? false;
  const actiepunten = actieRows ?? [];
  const documenten = (docRows ?? []) as DocKeuze[];
  const bjLabel = new Map(
    (boekjaren as Boekjaar[]).map((b) => [
      b.id,
      `${datum(b.start_datum)} – ${datum(b.eind_datum)}`,
    ]),
  );
  const docNaam = new Map(documenten.map((d) => [d.id, d.naam]));

  const groepen: { status: ActiepuntStatus; items: Actiepunt[] }[] = (
    ["open", "bezig", "afgewerkt"] as ActiepuntStatus[]
  ).map((status) => ({
    status,
    items: actiepunten.filter((a) => a.status === status),
  }));
  const openTotaal = groepen[0].items.length + groepen[1].items.length;

  return (
    <div className="space-y-5">
      <TerugLink href="/admin/dashboard">Dashboard</TerugLink>

      <div>
        <h1 className="text-xl font-semibold">Actiepunten</h1>
        <p className="text-sm text-muted-foreground">
          Opvolgpunten voor {vme.naam}. {openTotaal} openstaand. Handmatig
          toevoegen of overnemen uit een jaarverslag / notulen.
        </p>
      </div>

      {migratieNodig && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          De tabel <code>actiepunt</code> bestaat nog niet. Draai migratie{" "}
          <code>20260901120000_actiepunt.sql</code> in de Supabase SQL Editor.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actiepunt toevoegen</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateActiepuntForm
              vmeId={vme.id}
              boekjaren={boekjaren}
              documenten={documenten}
              boekjaarId={boekjaar?.id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uit een jaarverslag</CardTitle>
            <CardDescription>
              Plak het stuk uit de notulen; elke regel wordt een actiepunt. Je
              kan ze daarna nog aanpassen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportActiepuntenDialog
              vmeId={vme.id}
              boekjaren={boekjaren}
              documenten={documenten}
              boekjaarId={boekjaar?.id}
            />
          </CardContent>
        </Card>
      </div>

      {groepen.map((g) =>
        g.items.length === 0 ? null : (
          <Card
            key={g.status}
            className={g.status === "afgewerkt" ? "opacity-70" : undefined}
          >
            <CardHeader>
              <CardTitle className="text-base">
                {STATUS_LABEL[g.status]} ({g.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {g.items.map((a) => {
                const teLaat =
                  a.status !== "afgewerkt" &&
                  a.deadline != null &&
                  a.deadline < vandaag();
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p
                        className={
                          a.status === "afgewerkt"
                            ? "font-medium line-through"
                            : "font-medium"
                        }
                      >
                        {a.titel}
                      </p>
                      {a.omschrijving && (
                        <p className="text-sm text-muted-foreground">
                          {a.omschrijving}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {a.deadline && (
                          <Badge variant={teLaat ? "destructive" : "outline"}>
                            deadline {datum(a.deadline)}
                          </Badge>
                        )}
                        {a.verantwoordelijke && (
                          <span>{a.verantwoordelijke}</span>
                        )}
                        {a.boekjaar_id && bjLabel.has(a.boekjaar_id) && (
                          <span>· {bjLabel.get(a.boekjaar_id)}</span>
                        )}
                        {a.bron === "jaarverslag" && (
                          <Badge variant="secondary">uit jaarverslag</Badge>
                        )}
                        {a.bron === "av" && (
                          <Badge variant="secondary">uit AV</Badge>
                        )}
                        {a.document_id && docNaam.has(a.document_id) && (
                          <span>· 📎 {docNaam.get(a.document_id)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <ActiepuntStatusKnop id={a.id} status={a.status} />
                      <EditActiepuntDialog
                        actiepunt={a}
                        boekjaren={boekjaren}
                        documenten={documenten}
                      />
                      <ActionForm
                        action={deleteActiepunt}
                        hiddenFields={{ id: a.id }}
                      >
                        <ConfirmSubmit
                          size="sm"
                          variant="ghost"
                          message="Actiepunt verwijderen?"
                        >
                          ✕
                        </ConfirmSubmit>
                      </ActionForm>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ),
      )}

      {actiepunten.length === 0 && !migratieNodig && (
        <p className="text-sm text-muted-foreground">
          Nog geen actiepunten.
        </p>
      )}
    </div>
  );
}
