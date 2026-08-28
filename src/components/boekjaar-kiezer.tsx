"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Navigeert naar `?boekjaar=<id>` op de huidige route. */
export function BoekjaarKiezer({
  basePath,
  boekjaren,
  actief,
}: {
  basePath: string;
  boekjaren: { id: string; label: string }[];
  actief: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={actief}
      onValueChange={(v) => router.push(`${basePath}?boekjaar=${v}`)}
    >
      <SelectTrigger className="min-w-[16rem]">
        <SelectValue placeholder="Kies boekjaar" />
      </SelectTrigger>
      <SelectContent>
        {boekjaren.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
