import { VmeNav } from "./vme-nav";

export default function VmeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Details VME</h1>
        <p className="text-sm text-muted-foreground">
          De gegevens van de gekozen VME, de structuur (appartementen, garages,
          parkeerplaatsen en hun quotiteit) en de bijhorende eigenaars en
          huurders.
        </p>
      </div>
      <VmeNav />
      {children}
    </div>
  );
}
