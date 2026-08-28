import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Pagina niet gevonden</h1>
      <p className="text-muted-foreground">
        Deze pagina bestaat niet of je hebt er geen toegang toe.
      </p>
      <Link href="/" className="underline">
        Terug naar start
      </Link>
    </main>
  );
}
