import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getActiveContext } from "@/lib/vme-context";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { ContextBar } from "@/components/context-bar";

const NAV: NavGroup[] = [
  {
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
      {
        href: "/admin/financien",
        label: "Kosten & Opbrengsten",
        icon: "financien",
      },
      { href: "/admin/voorschotten", label: "Voorschotten", icon: "voorschotten" },
      { href: "/admin/meterstanden", label: "Meterstanden", icon: "meterstanden" },
      { href: "/admin/afrekeningen", label: "Afrekeningen", icon: "afrekeningen" },
      { href: "/admin/actiepunten", label: "Actiepunten", icon: "actiepunten" },
      { href: "/admin/av", label: "Algemene Vergadering", icon: "av" },
      { href: "/admin/verzekeringen", label: "Verzekeringen", icon: "verzekeringen" },
      { href: "/admin/documenten", label: "Documenten", icon: "documenten" },
      { href: "/admin/instellingen", label: "Instellingen", icon: "instellingen" },
    ],
  },
];

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

  return (
    <AppShell
      title="MyVME"
      subtitle="Syndicus"
      nav={NAV}
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
