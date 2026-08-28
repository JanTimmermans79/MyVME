import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoVme } from "@/components/no-vme";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  Afrekening,
  Boekjaar,
  Eigenaar,
  Huurder,
  Unit,
} from "@/lib/types";
import { berekenEnBewaar } from "./actions";
import {
  AfrekeningTabel,
  BoekjaarKiezer,
  type AfrekeningRij,
} from "./afrekening-client";

export const metadata = { title: "Afrekeningen" };

export default async function AfrekeningenPage({
  searchParams,
}: PageProps<"/admin/afrekeningen">) {
  const { active } = await getActiveVme();
  if (!active) return <NoVme />;

  const sp = await searchParams;
  const supabase = await createClient();

  const { data: boekjaren } = await supabase
    .from("boekjaar")
    .select("*")
    .eq("vme_id", active.id)
    .order("start_datum", { ascending: false })
    .returns<Boekjaar[]>();

  const boekjaarOpts = (boekjaren ?? []).map((b) => ({
    id: b.id,
    label: `${datum(b.start_datum)} – ${datum(b.eind_datum)}${
      b.status === "afgesloten" ? " (afgesloten)" : ""
    }`,
  }));

  const gekozen =
    (typeof sp.boekjaar === "string" ? sp.boekjaar : undefined) ??
    boekjaren?.[0]?.id;
  const boekjaar = (boekjaren ?? []).find((b) => b.id === gekozen);

  let rijen: AfrekeningRij[] = [];
  if (boekjaar) {
    const { data: units } = await supabase
      .from("unit")
      .select("*")
      .eq("vme_id", active.id)
      .returns<Unit[]>();
    const unitIds = (units ?? []).map((u) => u.id);
    const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));

    const [{ data: afrekeningen }, { data: eigenaars }, { data: huurders }] =
      await Promise.all([
        supabase
          .from("afrekening")
          .select("*")
          .eq("boekjaar_id", boekjaar.id)
          .returns<Afrekening[]>(),
        unitIds.length
          ? supabase
              .from("eigenaar")
              .select("*")
              .in("unit_id", unitIds)
              .returns<Eigenaar[]>()
          : Promise.resolve({ data: [] as Eigenaar[] }),
        unitIds.length
          ? supabase
              .from("huurder")
              .select("*")
              .in("unit_id", unitIds)
              .returns<Huurder[]>()
          : Promise.resolve({ data: [] as Huurder[] }),
      ]);

    const eigenaarByUnit = new Map<string, Eigenaar>();
    for (const e of eigenaars ?? [])
      if (!eigenaarByUnit.has(e.unit_id)) eigenaarByUnit.set(e.unit_id, e);

    const huurderByUnit = new Map<string, Huurder>();
    for (const h of huurders ?? []) {
      const cur = huurderByUnit.get(h.unit_id);
      if (!cur || (!h.uitgang_datum && cur.uitgang_datum))
        huurderByUnit.set(h.unit_id, h);
    }

    rijen = (afrekeningen ?? [])
      .map((a): AfrekeningRij => {
        const ontvanger =
          a.betaler_type === "eigenaar"
            ? eigenaarByUnit.get(a.unit_id)
            : huurderByUnit.get(a.unit_id);
        return {
          id: a.id,
          unit_naam: unitNaam.get(a.unit_id) ?? "—",
          betaler_type: a.betaler_type,
          verschuldigd: Number(a.verschuldigd),
          ontvangen: Number(a.ontvangen),
          saldo: Number(a.saldo),
          ontvanger_naam: ontvanger
            ? [
                (ontvanger as { voornaam?: string | null }).voornaam,
                ontvanger.naam,
              ]
                .filter(Boolean)
                .join(" ")
            : "onbekend",
          ontvanger_email: ontvanger?.email ?? null,
          mail_verzonden_op: a.mail_verzonden_op,
          mail_status: a.mail_status,
        };
      })
      .sort((x, y) => x.unit_naam.localeCompare(y.unit_naam));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jaarafrekening</CardTitle>
          <CardDescription>
            Per unit en per betaler wordt het verschuldigde aandeel berekend via
            de verdeelsleutel van elke kostenpost, en vergeleken met de
            ontvangen (gematchte) betalingen binnen de boekjaarperiode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {boekjaarOpts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Maak eerst een boekjaar aan.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <BoekjaarKiezer
                  boekjaren={boekjaarOpts}
                  actief={gekozen ?? ""}
                />
                {boekjaar && (
                  <ActionForm
                    action={berekenEnBewaar}
                    hiddenFields={{ boekjaar_id: boekjaar.id }}
                  >
                    <SubmitButton>Afrekeningen (her)berekenen</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {boekjaar && (
        <Card>
          <CardHeader>
            <CardTitle>
              Resultaat ({rijen.length}){" "}
            </CardTitle>
            <CardDescription>
              {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rijen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen berekende afrekeningen. Klik op “(her)berekenen”.
              </p>
            ) : (
              <AfrekeningTabel
                rijen={rijen}
                context={{
                  vme_naam: active.naam,
                  vme_iban: active.iban ?? "",
                  boekjaar: `${datum(boekjaar.start_datum)} – ${datum(
                    boekjaar.eind_datum,
                  )}`,
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
