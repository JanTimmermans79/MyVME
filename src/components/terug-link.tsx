import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Consistente "← Terug"-link boven elke sub-/detailpagina (spec §23). */
export function TerugLink({
  href,
  children = "Terug",
}: {
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" /> {children}
    </Link>
  );
}
