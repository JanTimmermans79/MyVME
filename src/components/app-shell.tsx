import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function AppShell({
  title,
  nav,
  userLabel,
  contextBar,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  nav: NavGroup[];
  userLabel: string;
  contextBar?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="font-semibold">
              {title}
            </Link>
            {backHref && (
              <Link
                href={backHref}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {backLabel ?? "← Terug"}
              </Link>
            )}
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {nav.map((group, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1">
                  {group.label && (
                    <span className="mr-0.5 text-[0.65rem] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                      {group.label}
                    </span>
                  )}
                  {group.items.map((item) => (
                    <NavLink key={item.href} href={item.href}>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{userLabel}</span>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="outline" size="sm">
                  Afmelden
                </Button>
              </form>
            </div>
          </div>
          {contextBar}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
