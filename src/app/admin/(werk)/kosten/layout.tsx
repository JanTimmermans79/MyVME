export default function KostenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Kosten</h1>
        <p className="text-sm text-muted-foreground">
          Alle kosten van het gekozen boekjaar, per ten laste van: huurders of
          eigenaars. Je past ze hier aan; de afrekeningen halen ze hier op.
        </p>
      </div>
      {children}
    </div>
  );
}
