import { createClient } from "@/lib/supabase/server";
import { getActiveVme } from "@/lib/vme-context";
import { NoVme } from "@/components/no-vme";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Unit } from "@/lib/types";
import { CreateUnitForm, UnitRij } from "./units-forms";

export const metadata = { title: "Structuur" };

export default async function StructuurPage() {
  const { active } = await getActiveVme();
  if (!active) return <NoVme />;

  const supabase = await createClient();
  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .eq("vme_id", active.id)
    .order("naam")
    .returns<Unit[]>();

  const totaal = (units ?? []).reduce((s, u) => s + (u.quotiteit ?? 0), 0);
  const heeftQuotiteit = (units ?? []).some((u) => u.quotiteit != null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Structuur van {active.naam}</CardTitle>
          <CardDescription>
            Appartementen, garageboxen, parkeerplaatsen en andere kavels met hun
            quotiteit (aandeel in de gemene delen). Eigenaars koppel je bij het
            tabblad Eigenaars.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!units || units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen kavels.</p>
          ) : (
            units.map((u) => <UnitRij key={u.id} unit={u} />)
          )}
          {heeftQuotiteit && (
            <p className="text-right text-sm font-medium tabular-nums">
              Totaal quotiteit: {totaal}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kavel toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUnitForm vmeId={active.id} />
        </CardContent>
      </Card>
    </div>
  );
}
