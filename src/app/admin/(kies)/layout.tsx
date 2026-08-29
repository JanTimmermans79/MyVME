import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Minimale shell voor de VME-kiezer: geen navigatie, geen contextbalk. */
export default function KiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold">
            MyVME · Syndicus
          </Link>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Afmelden
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
