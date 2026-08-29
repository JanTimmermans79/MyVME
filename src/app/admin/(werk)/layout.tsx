import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getActiveContext } from "@/lib/vme-context";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { ContextBar } from "@/components/context-bar";

const NAV: NavGroup[] = [
  {
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/bank", label: "Bankimport", icon: "bank" },
      { href: "/admin/kosten", label: "Kosten", icon: "kosten" },
      { href: "/admin/voorschotten", label: "Voorschotten", icon: "voorschotten" },
      { href: "/admin/tellers", label: "Meterstanden", icon: "meterstanden" },
      { href: "/admin/afrekeningen", label: "Afrekeningen", icon: "afrekeningen" },
      { href: "/admin/documenten", label: "Documenten", icon: "documenten" },
    ],
  },
  {
    label: "Beheer",
    items: [{ href: "/admin/config", label: "Configuratie", icon: "config" }],
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
