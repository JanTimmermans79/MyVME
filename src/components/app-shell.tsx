"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calculator,
  ChevronLeft,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Upload,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Icoon-namen die via de RSC-grens mogen (functies kunnen dat niet). */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  bank: Upload,
  kosten: Receipt,
  voorschotten: Wallet,
  meterstanden: Gauge,
  afrekeningen: Calculator,
  documenten: FileText,
  config: Settings,
  contact: UserRound,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon?: NavIconName;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  title,
  subtitle,
  nav,
  userLabel,
  contextBar,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: NavGroup[];
  userLabel: string;
  contextBar?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent md:hidden"
          aria-label="Menu sluiten"
        >
          <X className="size-4" />
        </button>
      </div>

      {backHref && (
        <Link
          href={backHref}
          className="mx-2 mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ChevronLeft className="size-3.5" />
          {backLabel ?? "Terug"}
        </Link>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        {nav.map((group, i) => (
          <div key={i} className="space-y-1">
            {group.label && (
              <p className="px-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon ? NAV_ICONS[item.icon] : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  {Icon && <Icon className="size-4 shrink-0" />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <p className="truncate px-1 pb-2 text-xs text-muted-foreground">
          {userLabel}
        </p>
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <LogOut className="size-3.5" /> Afmelden
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-linear-to-b from-app-bg-from to-app-bg-to">
      {/* desktop sidebar */}
      <div className="sticky top-0 hidden h-dvh md:block">{sidebar}</div>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-2.5 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Menu openen"
          >
            <Menu className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">{contextBar}</div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
