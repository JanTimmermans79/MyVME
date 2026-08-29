import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getActiveContext } from "@/lib/vme-context";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { ContextBar } from "@/components/context-bar";

const NAV: NavGroup[] = [
  {
    items: [
      { href: "/admin/dashboard", label: "Dashboard" },
      { href: "/admin/bank", label: "Bankimport" },
      { href: "/admin/kosten", label: "Kosten" },
      { href: "/admin/voorschotten", label: "Voorschotten" },
      { href: "/admin/tellers", label: "Meterstanden" },
      { href: "/admin/afrekeningen", label: "Afrekeningen" },
    ],
  },
  {
    label: "Beheer",
    items: [{ href: "/admin/config", label: "Configuratie" }],
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
      title="MyVME · Syndicus"
      nav={NAV}
      userLabel={session.email ?? "Syndicus"}
      backHref="/admin"
      backLabel="← Alle VME's"
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
