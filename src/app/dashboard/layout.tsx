import { requireUser } from "@/lib/auth";
import { getActiveContext } from "@/lib/vme-context";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { ContextBar } from "@/components/context-bar";

const NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Mijn overzicht", icon: "dashboard" },
      {
        href: "/dashboard/meterstanden",
        label: "Meterstanden",
        icon: "meterstanden",
      },
      { href: "/dashboard/contact", label: "Contactgegevens", icon: "contact" },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await requireUser();
  const ctx = await getActiveContext();

  return (
    <AppShell
      title="MyVME"
      subtitle="Eigenaar"
      nav={NAV}
      userLabel={session.profile?.volledige_naam ?? session.email ?? "Eigenaar"}
      contextBar={
        ctx.vme ? (
          <ContextBar
            vmes={ctx.vmes}
            vme={ctx.vme}
            boekjaren={ctx.boekjaren}
            boekjaar={ctx.boekjaar}
            canCreateBoekjaar={false}
          />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
