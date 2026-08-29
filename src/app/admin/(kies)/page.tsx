import { ArrowRight, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { kiesVme } from "@/app/admin/actions";
import { datum } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import type { Boekjaar } from "@/lib/types";
import { NieuweVmeKnop } from "./nieuwe-vme";

export const metadata = { title: "VME's" };

export default async function KiesVmePage() {
  const { vmes } = await getActiveContext();
  const supabase = await createClient();

  const vmeIds = vmes.map((v) => v.id);
  const [{ data: units }, { data: boekjaren }] = await Promise.all([
    vmeIds.length
      ? supabase.from("unit").select("id, vme_id").in("vme_id", vmeIds)
      : Promise.resolve({ data: [] as { id: string; vme_id: string }[] }),
    vmeIds.length
      ? supabase
          .from("boekjaar")
          .select("vme_id, start_datum, eind_datum")
          .in("vme_id", vmeIds)
          .order("start_datum", { ascending: false })
          .returns<Pick<Boekjaar, "vme_id" | "start_datum" | "eind_datum">[]>()
      : Promise.resolve({
          data: [] as Pick<Boekjaar, "vme_id" | "start_datum" | "eind_datum">[],
        }),
  ]);

  const unitCount = new Map<string, number>();
  for (const u of units ?? [])
    unitCount.set(u.vme_id, (unitCount.get(u.vme_id) ?? 0) + 1);

  const bjCount = new Map<string, number>();
  const laatsteBj = new Map<string, { start_datum: string; eind_datum: string }>();
  for (const b of boekjaren ?? []) {
    bjCount.set(b.vme_id, (bjCount.get(b.vme_id) ?? 0) + 1);
    if (!laatsteBj.has(b.vme_id)) laatsteBj.set(b.vme_id, b);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Kies een VME</h1>
        <p className="text-sm text-muted-foreground">
          Open een VME om erin te werken. Daarna kies je een boekjaar.
        </p>
      </div>

      {vmes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Er is nog geen VME. Maak er hieronder een aan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vmes.map((v) => {
            const bj = laatsteBj.get(v.id);
            return (
              <form key={v.id} action={kiesVme}>
                <input type="hidden" name="vme_id" value={v.id} />
                <button
                  type="submit"
                  className="group w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Building2 className="size-5 text-muted-foreground" />
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-2 font-medium">{v.naam}</p>
                  {v.adres && (
                    <p className="text-xs text-muted-foreground">{v.adres}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{unitCount.get(v.id) ?? 0} wooneenheden</span>
                    <span>{bjCount.get(v.id) ?? 0} boekjaren</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bj
                      ? `Laatste boekjaar: ${datum(bj.start_datum)} – ${datum(
                          bj.eind_datum,
                        )}`
                      : "Nog geen boekjaar"}
                  </p>
                </button>
              </form>
            );
          })}
        </div>
      )}

      <div className="border-t pt-4">
        <NieuweVmeKnop />
      </div>
    </div>
  );
}
