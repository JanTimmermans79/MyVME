import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getActiveContext } from "@/lib/vme-context";
import { createClient } from "@/lib/supabase/server";
import { huurdersVanBoekjaar } from "@/lib/huurders-boekjaar";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { ContextBar } from "@/components/context-bar";

// Het menu volgt de tabbladen van de Excel-afrekening. De onderliggende menu's
// van Detail huurders en Afrekening huurders zijn de huurders van het boekjaar.
function bouwNav(
  huurders: { id: string; naam: string }[],
  boekjaarId: string | null,
): NavGroup[] {
  const kaart = (basis: string) =>
    huurders.map((h) => ({
      href: `${basis}/${h.id}`,
      label: h.naam,
    }));
  const bj = boekjaarId ? `?boekjaar=${boekjaarId}` : "";
  return [
    {
      items: [
        { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
      ],
    },
    {
      label: "Boekjaar",
      items: [
        { href: "/admin/vme", label: "Details VME", icon: "vme" },
        { href: "/admin/tarieven", label: "Tarieven & parameters", icon: "tarieven" },
        { href: "/admin/meterstanden", label: "Meterstanden", icon: "meterstanden" },
        {
          href: "/admin/kosten",
          label: "Kosten",
          icon: "kosten",
          children: [
            { href: "/admin/kosten/huurders", label: "Onkosten huurders" },
            { href: "/admin/kosten/eigenaars", label: "Onkosten eigenaars" },
          ],
        },
        {
          href: "/admin/detail-huurders",
          label: "Detail huurders",
          icon: "huurders",
          children: kaart("/admin/detail-huurders"),
        },
        {
          href: "/admin/afrekeningen",
          label: "Afrekening huurders",
          icon: "afrekeningen",
          children: huurders.map((h) => ({
            href: `/admin/afrekeningen/huurder/${h.id}${bj}`,
            label: h.naam,
          })),
        },
        { href: "/admin/financien/zicht", label: "Zichtrekening", icon: "zicht" },
        { href: "/admin/financien/spaar", label: "Spaarrekening", icon: "spaar" },
        { href: "/admin/voorschotten", label: "Voorschotten", icon: "voorschotten" },
      ],
    },
    {
      label: "Beheer",
      items: [
        { href: "/admin/actiepunten", label: "Actiepunten", icon: "actiepunten" },
        { href: "/admin/av", label: "Algemene Vergadering", icon: "av" },
        { href: "/admin/verzekeringen", label: "Verzekeringen", icon: "verzekeringen" },
        { href: "/admin/documenten", label: "Documenten", icon: "documenten" },
        { href: "/admin/instellingen", label: "Instellingen", icon: "instellingen" },
      ],
    },
  ];
}

export default async function WerkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const ctx = await getActiveContext();

  // Geen actieve VME -> terug naar de kiezer. Zo werkt geen enkel werkscherm
  // zonder gekozen VME en zie je nooit data van een andere VME.
  if (!ctx.vme) redirect("/admin");

  const huurders = ctx.boekjaar
    ? await huurdersVanBoekjaar(await createClient(), ctx.vme.id, ctx.boekjaar)
    : [];

  return (
    <AppShell
      title="MyVME"
      subtitle="Syndicus"
      nav={bouwNav(huurders, ctx.boekjaar?.id ?? null)}
      userLabel={session.email ?? "Syndicus"}
      backHref="/admin"
      backLabel="Alle VME's"
      contextBar={
        <ContextBar
          vmes={ctx.vmes}
          vme={ctx.vme}
          boekjaren={ctx.boekjaren}
          boekjaar={ctx.boekjaar}
        />
      }
    >
      {children}
    </AppShell>
  );
}
