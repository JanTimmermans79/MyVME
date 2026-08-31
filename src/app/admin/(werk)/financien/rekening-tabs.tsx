"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RekeningTabs({
  basis,
  voorschotLabel,
}: {
  basis: string; // "/admin/financien/zicht" of "/admin/financien/spaar"
  voorschotLabel: string;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: `${basis}/kosten`, label: "Kosten" },
    { href: `${basis}/opbrengsten`, label: "Opbrengsten" },
    { href: `${basis}/voorschotcontrole`, label: voorschotLabel },
  ];
  return (
    <nav className="flex flex-wrap gap-1">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
