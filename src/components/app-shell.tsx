import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  title,
  nav,
  userLabel,
  children,
}: {
  title: string;
  nav: NavItem[];
  userLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">
            {title}
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
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
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
