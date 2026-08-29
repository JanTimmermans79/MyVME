import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatColor } from "@/components/stat-card";

const BADGE: Record<StatColor, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

export interface QuickAction {
  label: string;
  hint: string;
  icon: LucideIcon;
  color: StatColor;
  href: string;
}

export function QuickActions({ items }: { items: QuickAction[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
          >
            <div
              className={cn(
                "grid size-10 place-items-center rounded-xl text-white",
                BADGE[a.color],
              )}
            >
              <Icon className="size-5" />
            </div>
            <p className="text-sm font-medium">{a.label}</p>
            <p className="text-xs text-muted-foreground">{a.hint}</p>
          </Link>
        );
      })}
    </div>
  );
}
