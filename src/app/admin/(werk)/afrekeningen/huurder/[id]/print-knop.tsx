"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintKnop() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="size-3.5" /> Afdrukken / PDF
    </Button>
  );
}
