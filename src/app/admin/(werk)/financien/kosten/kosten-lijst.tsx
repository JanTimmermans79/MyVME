import Link from "next/link";
import type { Boekjaar, Kosten, Verdeelsleutel } from "@/lib/types";
import { kostenNaarRijen } from "@/lib/financien";
import { FinancieleTabel } from "@/components/financiele-tabel";
import { Badge } from "@/components/ui/badge";
import { EditKostDialog, ConfirmKostButton, DeleteKostButton } from "./kosten-forms";

export function KostenLijst({
  kosten,
  boekjaren,
  verdeelsleutels,
  categorieen,
  toonRekening = false,
}: {
  kosten: Kosten[];
  boekjaren: Boekjaar[];
  verdeelsleutels: Verdeelsleutel[];
  categorieen: string[];
  toonRekening?: boolean;
}) {
  const rijen = kostenNaarRijen(kosten, (k) => (
    <div className="flex items-center justify-end gap-2">
      {k.status === "voorstel" && (
        <Badge variant="outline" className="text-xs">
          voorstel{k.bron === "ai_voorstel" ? " · AI" : ""}
        </Badge>
      )}
      {k.document_url && (
        <Link
          href={`/admin/financien/document?path=${encodeURIComponent(k.document_url)}`}
          target="_blank"
          className="text-sm underline"
        >
          Bewijs
        </Link>
      )}
      {k.status === "voorstel" && <ConfirmKostButton id={k.id} />}
      <EditKostDialog
        kost={k}
        boekjaren={boekjaren}
        verdeelsleutels={verdeelsleutels}
        categorieen={categorieen}
      />
      <DeleteKostButton id={k.id} />
    </div>
  ));

  return (
    <FinancieleTabel
      rijen={rijen}
      toonRekening={toonRekening}
      totaalLabel="Totaal kosten"
      legeTekst="Nog geen kosten geregistreerd."
    />
  );
}
