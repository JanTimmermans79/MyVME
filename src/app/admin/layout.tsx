import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getActiveContext } from "@/lib/vme-context";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { ContextBar } from "@/components/context-bar";

const NAV: NavGroup[] = [
  { items: [{ href: "/admin", label: "Overzicht" }] },
  {
    label: "VME",
    items: [
      { href: "/admin/vme", label: "VME's" },
      { href: "/admin/units", label: "Wooneenheden" },
      { href: "/admin/eigenaars", label: "Eigenaars" },
      { href: "/admin/huurders", label: "Huurders" },
      { href: "/admin/verdeelsleutels", label: "Verdeelsleutels" },
      { href: "/admin/bankrelaties", label: "Bankrelaties" },
    ],
  },
  {
    label: "Boekjaar",
    items: [
      { href: "/admin/voorschotten", label: "Voorschotten" },
      { href: "/admin/kosten", label: "Kosten" },
      { href: "/admin/tellers", label: "Meterstanden" },
      { href: "/admin/mazout", label: "Mazout" },
      { href: "/admin/bank", label: "Bankimport" },
      { href: "/admin/afrekeningen", label: "Afrekeningen" },
    ],
  },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  const ctx = await getActiveContext();

  return (
    <AppShell
      title="MyVME · Syndicus"
      nav={NAV}
      userLabel={session.email ?? "Syndicus"}
      contextBar={
        ctx.vme ? (
          <ContextBar
            vmes={ctx.vmes}
            vme={ctx.vme}
            boekjaren={ctx.boekjaren}
            boekjaar={ctx.boekjaar}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nog geen VME.{" "}
            <Link href="/admin/vme" className="font-medium underline">
              Maak er eerst een aan
            </Link>
            .
          </p>
        )
      }
    >
      {children}
    </AppShell>
  );
}
