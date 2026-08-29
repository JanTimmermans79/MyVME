import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NoBoekjaar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geen boekjaar geselecteerd</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Kies of maak een boekjaar in de balk bovenaan. Alle schermen werken
        binnen dat boekjaar.
      </CardContent>
    </Card>
  );
}
