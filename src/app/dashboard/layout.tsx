import { requireUser } from "@/lib/auth";
import { AppShell, type NavGroup } from "@/components/app-shell";

const NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Mijn overzicht" },
      { href: "/dashboard/contact", label: "Contactgegevens" },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await requireUser();

  return (
    <AppShell
      title="MyVME"
      nav={NAV}
      userLabel={session.profile?.volledige_naam ?? session.email ?? "Eigenaar"}
    >
      {children}
    </AppShell>
  );
}
