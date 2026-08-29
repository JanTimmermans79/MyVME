import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  Eenheidsprijs,
  Huurder,
  Meterstand,
  Teller,
  Unit,
} from "@/lib/types";
import { verwijderMeterstand } from "./actions";
import {
  EenheidsprijsForm,
  MaakTellersButton,
  MeternummerRij,
  NieuweMeterstandDialog,
} from "./tellers-client";

export const metadata = { title: "Tellers & verbruik" };

export default async function TellersPage() {
  const { vme: active, boekjaar } = await getActiveContext();
  if (!active || !boekjaar) return <NoBoekjaar />;
  const gekozenId = boekjaar.id;

  const supabase = await createClient();

  const { data: prijs } = await supabase
    .from("eenheidsprijs")
    .select("*")
    .eq("vme_id", active.id)
    .eq("boekjaar_id", gekozenId)
    .maybeSingle<Eenheidsprijs>();

  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .eq("vme_id", active.id)
    .order("naam")
    .returns<Unit[]>();
  const unitIds = (units ?? []).map((u) => u.id);

  const [{ data: tellers }, { data: huurders }] = await Promise.all([
    unitIds.length
      ? supabase.from("teller").select("*").in("unit_id", unitIds).returns<Teller[]>()
      : Promise.resolve({ data: [] as Teller[] }),
    unitIds.length
      ? supabase.from("huurder").select("*").in("unit_id", unitIds).returns<Huurder[]>()
      : Promise.resolve({ data: [] as Huurder[] }),
  ]);

  const tellerIds = (tellers ?? []).map((t) => t.id);
  const { data: standen } = tellerIds.length
    ? await supabase
        .from("meterstand")
        .select("*")
        .in("teller_id", tellerIds)
        .order("datum", { ascending: false })
        .returns<Meterstand[]>()
    : { data: [] as Meterstand[] };

  const tellersByUnit = new Map<string, Teller[]>();
  for (const t of tellers ?? []) {
    const l = tellersByUnit.get(t.unit_id) ?? [];
    l.push(t);
    tellersByUnit.set(t.unit_id, l);
  }
  const standenByTeller = new Map<string, Meterstand[]>();
  for (const s of standen ?? []) {
    const l = standenByTeller.get(s.teller_id) ?? [];
    l.push(s);
    standenByTeller.set(s.teller_id, l);
  }
  const huurdersByUnit = new Map<string, Huurder[]>();
  for (const h of huurders ?? []) {
    const l = huurdersByUnit.get(h.unit_id) ?? [];
    l.push(h);
    huurdersByUnit.set(h.unit_id, l);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Eenheidsprijzen</CardTitle>
          <CardDescription>
            Per boekjaar. Water geldt voor koud én warm water. Stookolie ={" "}
            (Δ CV × liter/m³ + Δ warm water × liter/m³) × mazoutprijs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EenheidsprijsForm
            vmeId={active.id}
            boekjaarId={gekozenId}
            huidig={prijs ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tellers per appartement</CardTitle>
          <CardDescription>
            Elk appartement heeft een teller voor koud water, warm water en CV.
            De meterstand op het einde van elk boekjaar (of bij een huurderwissel)
            bepaalt het verbruik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Maak eerst units aan.</p>
          ) : (
            units.map((u) => {
              const ut = tellersByUnit.get(u.id) ?? [];
              return (
                <div key={u.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{u.naam}</span>
                    {ut.length === 0 ? (
                      <MaakTellersButton unitId={u.id} />
                    ) : (
                      <NieuweMeterstandDialog
                        unitId={u.id}
                        unitNaam={u.naam}
                        tellers={ut}
                        huurders={huurdersByUnit.get(u.id) ?? []}
                      />
                    )}
                  </div>
                  {ut.length > 0 && (
                    <div className="space-y-3">
                      {ut
                        .slice()
                        .sort((a, b) => a.type.localeCompare(b.type))
                        .map((t) => {
                          const st = standenByTeller.get(t.id) ?? [];
                          return (
                            <div key={t.id}>
                              <MeternummerRij teller={t} />
                              {st.length > 0 && (
                                <ul className="ml-32 mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {st.slice(0, 4).map((s) => (
                                    <li
                                      key={s.id}
                                      className="flex items-center gap-2"
                                    >
                                      {datum(s.datum)}: {Number(s.waarde)} m³ (
                                      {s.aanleiding})
                                      <ActionForm
                                        action={verwijderMeterstand}
                                        hiddenFields={{ id: s.id }}
                                      >
                                        <ConfirmSubmit
                                          size="sm"
                                          variant="ghost"
                                          message="Meterstand verwijderen?"
                                        >
                                          ✕
                                        </ConfirmSubmit>
                                      </ActionForm>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
