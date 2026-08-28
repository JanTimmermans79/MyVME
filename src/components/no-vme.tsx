import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NoVme() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geen actieve VME</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <Link href="/admin/vme" className="underline">
          Maak eerst een VME aan
        </Link>
        .
      </CardContent>
    </Card>
  );
}
