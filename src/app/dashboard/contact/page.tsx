import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Eigenaar, Huurder, Unit } from "@/lib/types";
import {
  EigenContactForm,
  AddHuurderDialog,
  EditHuurderDialog,
} from "./contact-forms";

export const metadata = { title: "Contactgegevens" };

export default async function ContactPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: eigenaars } = await supabase
    .from("eigenaar")
    .select("*")
    .returns<Eigenaar[]>();
  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .returns<Unit[]>();
  const { data: huurders } = await supabase
    .from("huurder")
    .select("*")
    .order("ingang_datum", { ascending: false })
    .returns<Huurder[]>();

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));

  if (!eigenaars || eigenaars.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nog niet gekoppeld</CardTitle>
          <CardDescription>
            Je account is nog niet aan een unit gekoppeld.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {eigenaars.map((eig) => {
        const unit = unitById.get(eig.unit_id);
        const unitHuurders = (huurders ?? []).filter(
          (h) => h.unit_id === eig.unit_id,
        );
        return (
          <Card key={eig.id}>
            <CardHeader>
              <CardTitle>{unit?.naam ?? "Unit"}</CardTitle>
              <CardDescription>Jouw contactgegevens als eigenaar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <EigenContactForm eigenaar={eig} />

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Huurder(s)</h3>
                  {unit && <AddHuurderDialog unit={unit} />}
                </div>
                {unitHuurders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Geen huurders geregistreerd.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {unitHuurders.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{h.naam}</p>
                          <p className="text-muted-foreground">
                            {h.email ?? "geen e-mail"} · {h.telefoon ?? "geen tel."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {h.ingang_datum ? datum(h.ingang_datum) : "?"} –{" "}
                            {h.uitgang_datum ? datum(h.uitgang_datum) : "heden"}
                          </p>
                        </div>
                        <EditHuurderDialog huurder={h} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
