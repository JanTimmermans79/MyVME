import { notFound } from "next/navigation";
import { TerugLink } from "@/components/terug-link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import { isActiefEigenaar } from "@/lib/archief";
import { berekenHuurderAfrekeningen } from "@/lib/huurder-afrekening";
import type { Afrekening, Eigenaar } from "@/lib/types";
import { HuurderAfrekeningVerstuur } from "./verstuur";
import { PrintKnop } from "./print-knop";

export const metadata = { title: "Afrekening huurder" };

const WATER = ["koud_water", "warm_water", "water_basis", "water_comfort"];
const getal = (n: number) =>
  n.toLocaleString("nl-BE", { maximumFractionDigits: 3 });
const naarBoven5 = (n: number) => Math.ceil(n / 5) * 5;

/** Eerste dag van de maand na `iso` (YYYY-MM-DD). */
function volgendeMaand(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
}

function Rij({
  label,
  waarde,
  uitleg,
  vet,
}: {
  label: string;
  waarde: string;
  uitleg?: string;
  vet?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,15rem)_7rem_1fr] gap-3 py-0.5 ${vet ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span className="text-right tabular-nums">{waarde}</span>
      <span className="text-xs text-muted-foreground print:text-[10px]">
        {uitleg}
      </span>
    </div>
  );
}

export default async function HuurderAfrekeningPagina({
  params,
  searchParams,
}: PageProps<"/admin/afrekeningen/huurder/[id]">) {
  await requireAdmin();
  const { id: huurderId } = await params;
  const sp = await searchParams;
  const gevraagd = typeof sp.boekjaar === "string" ? sp.boekjaar : undefined;

  const { vme, boekjaren, boekjaar: actief } = await getActiveContext();
  const boekjaar = boekjaren.find((b) => b.id === gevraagd) ?? actief;
  if (!vme || !boekjaar) notFound();

  const db = createAdminClient();
  const resultaten = await berekenHuurderAfrekeningen(db, boekjaar.id);
  const h = resultaten.find((x) => x.huurder_id === huurderId);
  if (!h) notFound();

  const [{ data: opgeslagen }, { data: eigenaars }] = await Promise.all([
    db
      .from("afrekening")
      .select("*")
      .eq("boekjaar_id", boekjaar.id)
      .eq("huurder_id", huurderId)
      .eq("betaler_type", "huurder")
      .maybeSingle<Afrekening>(),
    db
      .from("eigenaar")
      .select("*")
      .eq("unit_id", h.unit_id)
      .returns<Eigenaar[]>(),
  ]);

  const verhuurder =
    (eigenaars ?? [])
      .filter((e) => isActiefEigenaar(e))
      .map((e) => [e.voornaam, e.naam].filter(Boolean).join(" "))
      .join(" & ") ||
    vme.syndicus_naam ||
    "";

  // --- cijfers voor de afrekening
  const jaar = `${boekjaar.start_datum.slice(0, 4)}-${boekjaar.eind_datum.slice(0, 4)}`;
  const som = (soorten: string[]) =>
    h.lijnen.filter((l) => soorten.includes(l.soort)).reduce((s, l) => s + l.bedrag, 0);
  const stookolie = h.lijnen.find((l) => l.soort === "stookolie");
  const stookolieLiter = stookolie?.hoeveelheid ?? 0;
  const warm = h.meters.warm.delta;
  const koud = h.meters.koud.delta;
  const gedeeld = h.lijnen.filter(
    (l) => l.soort === "gedeeld" || l.soort === "administratie",
  );
  const sleutelPct = h.lijnen.find((l) => l.soort === "gedeeld")?.hoeveelheid ?? 0;
  const tegoed = h.saldo > 0.004 ? h.saldo : 0;
  const verschuldigd = h.saldo < -0.004 ? -h.saldo : 0;

  // Voorstel voor het maandelijkse voorschot (enkel voor wie blijft).
  const maanden = h.boekjaar_dagen > 0 ? (h.dagen / h.boekjaar_dagen) * 12 : 12;
  const voorstel =
    !h.vertrokken_in_boekjaar && maanden > 0
      ? naarBoven5(h.totaal_kosten / maanden)
      : null;

  const periode = `${datum(h.periode_start)} – ${datum(h.periode_eind)}`;
  const lijnenTekst = h.lijnen
    .map(
      (l) =>
        `${l.omschrijving}: ${l.hoeveelheid ?? ""} ${l.eenheid ?? ""} → ${euro(l.bedrag)}`,
    )
    .join("\n");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <TerugLink href={`/admin/afrekeningen?boekjaar=${boekjaar.id}`}>
          Alle afrekeningen
        </TerugLink>
        <div className="flex flex-wrap items-center gap-2">
          <PrintKnop />
        </div>
      </div>

      {h.waarschuwingen.length > 0 && (
        <ul className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          {h.waarschuwingen.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {/* De afrekening zelf: A4-vriendelijk en zonder bewerkbare onderdelen. */}
      <article className="mx-auto max-w-3xl space-y-5 rounded-lg border bg-card p-8 text-sm leading-relaxed shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Jaarlijkse afrekening {jaar}</h1>
          <p className="text-muted-foreground">{vme.naam}</p>
        </header>

        <section className="space-y-0.5">
          <p>
            <span className="inline-block w-40 text-muted-foreground">
              Ter attentie van:
            </span>
            <strong>{h.huurder_naam}</strong>
          </p>
          <p>
            <span className="inline-block w-40 text-muted-foreground">
              Appartement:
            </span>
            {h.unit_naam}
            {vme.adres ? ` — ${vme.adres}` : ""}
          </p>
          <p>
            <span className="inline-block w-40 text-muted-foreground">
              Periode:
            </span>
            {periode}
          </p>
        </section>

        <section className="space-y-0.5">
          <h2 className="mb-1 font-semibold">Detail van de kosten</h2>
          <Rij
            label="Stookolie verbruik:"
            waarde={`${getal(stookolieLiter)} liters`}
            uitleg="op basis van de individuele meterstanden"
          />
          <Rij
            label="Warm water:"
            waarde={`${getal(warm)} m³`}
            uitleg="op basis van de individuele meterstanden"
          />
          <Rij
            label="Koud water:"
            waarde={`${getal(koud)} m³`}
            uitleg="op basis van de individuele meterstanden"
          />
          <div className="h-2" />
          <Rij
            label="Stookolie:"
            waarde={euro(som(["stookolie"]))}
            uitleg="op basis van de individuele meterstanden"
          />
          <Rij
            label="Water:"
            waarde={euro(som(WATER))}
            uitleg="op basis van de individuele meterstanden"
          />
        </section>

        <section className="space-y-0.5">
          <p className="mb-1">
            <span className="font-semibold">Toegepaste sleutel:</span>{" "}
            {h.dagen}/{h.boekjaar_dagen} dagen aanwezig
            {sleutelPct > 0 ? ` (${getal(sleutelPct)}% van de gedeelde kosten)` : ""}
          </p>
          {gedeeld.map((l, i) => (
            <Rij
              key={i}
              label={`${l.omschrijving.split(" (")[0].replace(/^./, (c) => c.toUpperCase())}:`}
              waarde={euro(l.bedrag)}
            />
          ))}
        </section>

        <section className="space-y-0.5 border-t pt-3">
          <Rij label="Totale kost" waarde={euro(h.totaal_kosten)} vet />
          <Rij label="Ontvangen voorschotten" waarde={euro(h.voorschot_ontvangen)} />
          <div className="h-1" />
          <Rij label="Saldo" waarde={euro(h.saldo)} vet />
        </section>

        <section className="space-y-1">
          <h2 className="font-semibold">Resultaat van de afrekening</h2>
          <p>
            Het tegoed van <strong>{euro(tegoed)}</strong> wordt binnen 30
            kalenderdagen na verzending van deze afrekening teruggestort.
          </p>
          <p>
            Het verschuldigde saldo van <strong>{euro(verschuldigd)}</strong>{" "}
            dient binnen 30 kalenderdagen na ontvangst van deze afrekening
            betaald te worden op rekening van de {vme.naam}
            {vme.iban ? `: ${vme.iban}` : ""} met vermelding &quot;afrekening{" "}
            {boekjaar.start_datum.slice(0, 4)}&quot;.
          </p>
          <p className="text-muted-foreground">
            De onderliggende bewijsstukken kunnen op verzoek worden ingekeken bij
            de verhuurder of beheerder.
          </p>
        </section>

        {voorstel != null && (
          <section className="space-y-0.5 rounded-md border border-dashed p-3 print:border-solid">
            <p className="mb-1">
              Op basis van de werkelijke kosten stellen wij voor het maandelijkse
              voorschot aan te passen:
            </p>
            <Rij label="Huidig voorschot:" waarde={euro(h.voorschot_per_maand)} />
            <Rij label="Nieuw voorgesteld voorschot:" waarde={euro(voorstel)} />
            <Rij
              label="Verschil:"
              waarde={`${euro(voorstel - h.voorschot_per_maand)} per maand`}
            />
            <Rij
              label="Voorgestelde ingangsdatum:"
              waarde={datum(volgendeMaand(boekjaar.eind_datum))}
            />
            <p className="pt-1 text-xs text-muted-foreground">
              Deze aanpassing heeft tot doel de voorschotten beter af te stemmen
              op de werkelijke kosten.
            </p>
          </section>
        )}

        <footer className="pt-2">
          <p>Met vriendelijke groet,</p>
          <p className="mt-6 font-medium">{verhuurder}</p>
        </footer>
      </article>

      <div className="mx-auto max-w-3xl print:hidden">
        <HuurderAfrekeningVerstuur
          data={{
            afrekening_id: opgeslagen?.id ?? null,
            to_email: h.huurder_email,
            to_name: h.huurder_naam,
            vme_naam: vme.naam,
            vme_iban: vme.iban ?? "",
            periode,
            unit_naam: h.unit_naam,
            lijnen_tekst: lijnenTekst,
            totaal_kosten: h.totaal_kosten,
            voorschot_ontvangen: h.voorschot_ontvangen,
            saldo: h.saldo,
          }}
        />
      </div>
    </div>
  );
}
