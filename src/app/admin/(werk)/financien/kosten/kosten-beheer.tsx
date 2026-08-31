import type { Boekjaar, Verdeelsleutel, VmeRekening } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { genereerKostenUitBank } from "./actions";
import { CreateKostForm } from "./kosten-forms";

export function KostenBeheer({
  vmeId,
  rekening,
  boekjaren,
  verdeelsleutels,
  categorieen,
}: {
  vmeId: string;
  rekening: VmeRekening;
  boekjaren: Boekjaar[];
  verdeelsleutels: Verdeelsleutel[];
  categorieen: string[];
}) {
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Kosten uit de bank</CardTitle>
            <CardDescription>
              Maakt kostenvoorstellen uit betalingen (soort “kost”) op de{" "}
              {rekening}rekening die aan een geconfigureerde leverancier
              gekoppeld zijn. Bevestig ze daarna in de lijst.
            </CardDescription>
          </div>
          <ActionForm
            action={genereerKostenUitBank}
            hiddenFields={{ vme_id: vmeId, rekening }}
          >
            <SubmitButton size="sm">Genereer uit bank</SubmitButton>
          </ActionForm>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kost manueel toevoegen</CardTitle>
          <CardDescription>
            Wordt op de {rekening}rekening geboekt. Bewijsstukken worden privé
            bewaard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {boekjaren.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Maak eerst een boekjaar aan.
            </p>
          ) : (
            <CreateKostForm
              vmeId={vmeId}
              rekening={rekening}
              boekjaren={boekjaren}
              verdeelsleutels={verdeelsleutels}
              categorieen={categorieen}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
