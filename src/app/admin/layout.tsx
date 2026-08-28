import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getActiveVme } from "@/lib/vme-context";
import { AppShell, type NavItem } from "@/components/app-shell";
import { VmeSwitcher } from "@/components/vme-switcher";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/vme", label: "VME's" },
  { href: "/admin/boekjaren", label: "Boekjaren" },
  { href: "/admin/units", label: "Units" },
  { href: "/admin/verdeelsleutels", label: "Verdeelsleutels" },
  { href: "/admin/eigenaars", label: "Eigenaars" },
  { href: "/admin/kosten", label: "Kosten" },
  { href: "/admin/mazout", label: "Mazout" },
  { href: "/admin/voorschotten", label: "Voorschotten" },
  { href: "/admin/bank", label: "Bankimport" },
  { href: "/admin/afrekeningen", label: "Afrekeningen" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  const { vmes, active } = await getActiveVme();

  return (
    <AppShell
      title="MyVME · Syndicus"
      nav={NAV}
      userLabel={session.email ?? "Syndicus"}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Actieve VME:{" "}
          {active ? (
            <span className="font-medium text-foreground">{active.naam}</span>
          ) : (
            <Link href="/admin/vme" className="font-medium underline">
              Maak eerst een VME aan
            </Link>
          )}
        </div>
        {vmes.length > 1 && active && (
          <VmeSwitcher vmes={vmes} activeId={active.id} />
        )}
      </div>
      {children}
    </AppShell>
  );
}
