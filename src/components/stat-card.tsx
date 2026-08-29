import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatColor = "indigo" | "emerald" | "rose" | "blue" | "violet" | "amber";

const STYLES: Record<StatColor, { card: string; badge: string; value: string }> = {
  indigo: {
    card: "bg-indigo-50 dark:bg-indigo-950/40",
    badge: "bg-indigo-500",
    value: "text-indigo-950 dark:text-indigo-100",
  },
  emerald: {
    card: "bg-emerald-50 dark:bg-emerald-950/40",
    badge: "bg-emerald-500",
    value: "text-emerald-950 dark:text-emerald-100",
  },
  rose: {
    card: "bg-rose-50 dark:bg-rose-950/40",
    badge: "bg-rose-500",
    value: "text-rose-950 dark:text-rose-100",
  },
  blue: {
    card: "bg-sky-50 dark:bg-sky-950/40",
    badge: "bg-sky-500",
    value: "text-sky-950 dark:text-sky-100",
  },
  violet: {
    card: "bg-violet-50 dark:bg-violet-950/40",
    badge: "bg-violet-500",
    value: "text-violet-950 dark:text-violet-100",
  },
  amber: {
    card: "bg-amber-50 dark:bg-amber-950/40",
    badge: "bg-amber-500",
    value: "text-amber-950 dark:text-amber-100",
  },
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: LucideIcon;
  color: StatColor;
  href?: string;
}) {
  const s = STYLES[color];
  const body = (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl p-4 ring-1 ring-foreground/5 transition-shadow",
        s.card,
        href && "hover:shadow-md",
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.value)}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl text-white",
          s.badge,
        )}
      >
        <Icon className="size-5" />
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
