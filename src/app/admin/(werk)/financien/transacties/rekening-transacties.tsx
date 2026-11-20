import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { datum } from "@/lib/format";
import { NoBoekjaar } from "@/components/no-boekjaar";
import { hoortBijBoekjaar, boekjaarOrFilter } from "@/lib/boekjaar-transacties";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Transactie, Unit, VmeRekening } from "@/lib/types";
import { BankImporter } from "../bank/bank-importer";
import { TransactieTabel, type TransactieRij } from "./transactie-tabel";

const WIE: Record<string, string> = {
  gelijk_huurders: "huurders",
  gelijk_eigenaars: "eigenaars",
  per_quotiteit: "eigenaars",
  individueel_verbruik: "verbruik",
};

/**
 * Alle verrichtingen van één rekening in het gekozen boekjaar: importeren,
 * filteren, exporteren en per lijn aanduiden wat het is.
 */
export async function RekeningTransacties({ rekening }: { rekening: VmeRekening }) {
  const { vme, boekjaar, boekjaren } = await getActiveContext();
  if (!vme || !boekjaar) return <NoBoekjaar />;

  const supabase = await createClient();
  const [{ data: transacties }, { data: units }] = await Promise.all([
    supabase
      .from("transactie")
      .select("*")
      .eq("vme_id", vme.id)
      .eq("rekening", rekening)
      .or(boekjaarOrFilter(boekjaar))
      .order("datum", { ascending: false })
      .returns<Transactie[]>(),
    supabase.from("unit").select("id, naam").eq("vme_id", vme.id).returns<Pick<Unit, "id" | "naam">[]>(),
  ]);

  const lijst = (transacties ?? []).filter((t) => hoortBijBoekjaar(t, boekjaar));
  const ids = lijst.map((t) => t.id);
  const { data: kosten } = ids.length
    ? await supabase
        .from("kosten")
        .select("betaald_met_transactie_id, categorie, verdeling")
        .in("betaald_met_transactie_id", ids)
        .returns<{ betaald_met_transactie_id: string; categorie: string; verdeling: string }[]>()
    : { data: [] as { betaald_met_transactie_id: string; categorie: string; verdeling: string }[] };
  const kostPerTx = new Map((kosten ?? []).map((k) => [k.betaald_met_transactie_id, k]));
  const unitNaam = new Map((units ?? []).map((u) => [u.id, u.naam]));

  const rijen: TransactieRij[] = lijst.map((t) => {
    let keuze: string = t.soort;
    if (t.soort === "kost") {
      const k = kostPerTx.get(t.id);
      keuze = k ? `kost:${WIE[k.verdeling] ?? "huurders"}:${k.categorie}` : "kost";
    }
    return {
      id: t.id,
      datum: t.datum,
      bedrag: Number(t.bedrag),
      tegenpartij: t.tegenpartij_naam,
      iban: t.tegenpartij_iban,
      mededeling: t.mededeling,
      keuze,
      toegewezen: t.gematchte_unit_id
        ? `${unitNaam.get(t.gematchte_unit_id) ?? "—"}${t.betaler_type ? ` (${t.betaler_type})` : ""}`
        : null,
    };
  });

  const nogTeKiezen = rijen.filter((r) => r.keuze === "kost").length;
  const naam = rekening === "spaar" ? "spaarrekening" : "zichtrekening";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bankexport importeren</CardTitle>
          <CardDescription>
            KBC-PDF, KBC-CSV of XLS/XLSX voor de {naam}. Dubbele verrichtingen
            worden herkend en niet opnieuw toegevoegd.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankImporter
            vmeId={vme.id}
            boekjaarStart={boekjaar.start_datum}
            boekjaarEind={boekjaar.eind_datum}
            zichtIban={vme.iban}
            spaarIban={vme.iban_reserve}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Verrichtingen {naam} ({rijen.length})
          </CardTitle>
          <CardDescription>
            Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}.
            Duid per lijn aan wat het is. Een kost wordt meteen geboekt onder{" "}
            <Link href="/admin/kosten/huurders" className="underline">
              Kosten
            </Link>
            ; kies je daarna een andere soort, dan verdwijnt die boeking weer.
            Voorschotten koppel je aan een appartement via{" "}
            <Link href="/admin/financien/bank" className="underline">
              Bankbestanden
            </Link>
            .
            {nogTeKiezen > 0 && (
              <>
                {" "}
                <strong>{nogTeKiezen}</strong> kost(en) hebben nog geen rubriek.
              </>
            )}
            {boekjaren.length === 0 && null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactieTabel
            rijen={rijen}
            bestandsnaam={`${naam}-${boekjaar.start_datum.slice(0, 4)}-${boekjaar.eind_datum.slice(0, 4)}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
