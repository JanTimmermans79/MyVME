import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getActiveContext } from "@/lib/vme-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Instellingen" };

const GROEPEN: { titel: string; items: { href: string; label: string; hint: string }[] }[] =
  [
    {
      titel: "VME",
      items: [
        { href: "/admin/vme", label: "VME-gegevens", hint: "Naam, adres, IBAN's, aantal kavels" },
        { href: "/admin/boekjaren", label: "Boekjaren", hint: "Periodes openen, afsluiten, verwijderen" },
      ],
    },
    {
      titel: "Structuur",
      items: [
        { href: "/admin/units", label: "Appartementen", hint: "Wooneenheden van deze VME" },
        { href: "/admin/eigenaars", label: "Eigenaars", hint: "Eigenaar per appartement + login" },
        { href: "/admin/huurders", label: "Huurders", hint: "Huurder, contactgegevens, huurperiode" },
      ],
    },
    {
      titel: "Verrekening",
      items: [
        { href: "/admin/bankrelaties", label: "Leveranciers", hint: "Standaard toewijzing + verdeelwijze" },
        { href: "/admin/categorieen", label: "Categorieën", hint: "Kosten-/opbrengstcategorieën + groep" },
        { href: "/admin/verdeelsleutels", label: "Verdeelsleutels", hint: "Quotiteit-aandelen per appartement" },
        { href: "/admin/mazout", label: "Mazout", hint: "Stookolieleveringen en prijs" },
      ],
    },
  ];

export default async function InstellingenPage() {
  const { vme } = await getActiveContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Instellingen</h1>
        <p className="text-sm text-muted-foreground">
          Centrale gegevens van {vme?.naam}. Deze worden hier één keer beheerd en
          overal in de app hergebruikt.
        </p>
      </div>

      {GROEPEN.map((groep) => (
        <div key={groep.titel} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {groep.titel}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groep.items.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {item.label}
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {item.hint}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
