import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { voorschotControle } from "@/lib/voorschot-controle";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { VoorschotcontroleTabel } from "@/components/voorschotcontrole-tabel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Voorschotcontrole huurders" };

export default async function Page() {
  const { boekjaar } = await getActiveContext();
  if (!boekjaar) return <NoBoekjaar />;

  const regels = (
    await voorschotControle(createAdminClient(), boekjaar.id)
  ).filter((r) => r.soort === "bewoner");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Voorschotcontrole huurders</CardTitle>
        <CardDescription>
          Opgelegde huurdersvoorschotten vs. effectief ontvangen op de
          zichtrekening, pro rata t.e.m. vandaag.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VoorschotcontroleTabel regels={regels} />
      </CardContent>
    </Card>
  );
}
