import { FinancienNav } from "./financien-nav";

export default function FinancienLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Kosten &amp; Opbrengsten</h1>
        <p className="text-sm text-muted-foreground">
          Bankbestanden, kosten en de voorschotcontrole per rekening.
        </p>
      </div>
      <FinancienNav />
      {children}
    </div>
  );
}
