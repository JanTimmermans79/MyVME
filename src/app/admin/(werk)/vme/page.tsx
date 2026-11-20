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
import type { Vme } from "@/lib/types";
import { VmeGegevensForm, VerwijderVmeKnop } from "./vme-forms";

export const metadata = { title: "VME-gegevens" };

export default async function VmePage() {
  const { vme: actief } = await getActiveContext();
  if (!actief) return <NoVme />;

  const supabase = await createClient();
  const { data: vme } = await supabase
    .from("vme")
    .select("*")
    .eq("id", actief.id)
    .maybeSingle<Vme>();
  if (!vme) return <NoVme />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{vme.naam}</CardTitle>
          <CardDescription>
            Pas de gegevens aan en klik op Opslaan. Een nieuwe VME toevoeg je via
            de keuzepagina van alle VME&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VmeGegevensForm key={vme.id} vme={vme} />
        </CardContent>
      </Card>

      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          VME verwijderen
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Kan alleen als alle appartementen eerst verwijderd zijn.
          </p>
          <VerwijderVmeKnop vme={vme} />
        </div>
      </details>
    </div>
  );
}
