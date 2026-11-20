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
      titel: "Boekjaren",
      items: [
        { href: "/admin/boekjaren", label: "Boekjaren", hint: "Periodes openen, afsluiten, verwijderen" },
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
          Beheer van {vme?.naam}: boekjaren, leveranciers, categorieën, verdeelsleutels en mazoutleveringen. De VME-gegevens, structuur, eigenaars, huurders en tarieven vind je in het menu Boekjaar.
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
