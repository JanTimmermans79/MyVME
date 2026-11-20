"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/vme", label: "VME-gegevens", exact: true },
  { href: "/admin/vme/structuur", label: "Structuur" },
  { href: "/admin/vme/eigenaars", label: "Eigenaars" },
  { href: "/admin/vme/huurders", label: "Huurders" },
];

export function VmeNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b pb-2">
      {ITEMS.map((it) => {
        const active = it.exact
          ? pathname === it.href
          : pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
