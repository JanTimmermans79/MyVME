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

export const metadata = { title: "Voorschotcontrole eigenaars" };

export default async function Page() {
  const { boekjaar } = await getActiveContext();
  if (!boekjaar) return <NoBoekjaar />;

  const regels = (
    await voorschotControle(createAdminClient(), boekjaar.id)
  ).filter((r) => r.soort === "reservefonds");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Voorschotcontrole eigenaars</CardTitle>
        <CardDescription>
          Opgelegde reservefonds-provisies vs. effectief ontvangen op de
          spaarrekening, pro rata t.e.m. vandaag.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VoorschotcontroleTabel regels={regels} toonKapitaal />
      </CardContent>
    </Card>
  );
}
