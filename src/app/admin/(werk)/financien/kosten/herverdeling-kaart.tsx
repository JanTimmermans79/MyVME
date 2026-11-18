"use client";

import { useState } from "react";
import type { HerverdelingInfo } from "@/lib/herverdeling";
import { euro } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pasHerverdelingToe, verwijderHerverdeling } from "./herverdeling-actions";

const PRESETS = [0, 25, 50, 75, 100];
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function HerverdelingKaart({
  vmeId,
  boekjaarId,
  info,
}: {
  vmeId: string;
  boekjaarId: string;
  info: HerverdelingInfo;
}) {
  const start = info.actief?.bedrag ?? info.voorstel ?? 0;
  const [bedrag, setBedrag] = useState(String(start || ""));
  const [pct, setPct] = useState(String(info.actief?.pctHuurders ?? 50));
  const [toelichting, setToelichting] = useState(
    info.actief?.toelichting ??
      "defecte regenwaterpomp: stadswater i.p.v. regenwater",
  );

  const b = Number(bedrag.replace(",", ".")) || 0;
  const p = Math.min(100, Math.max(0, Number(pct.replace(",", ".")) || 0));
  const huurders = round2((b * p) / 100);
  const eigenaars = round2(b - huurders);

  return (
    <div className="space-y-5">
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Cijfer label={`Facturen ${info.categorie}`} waarde={euro(info.facturen)} />
        <Cijfer
          label="Aan huurders aangerekend via tellers"
          waarde={info.viaTellers == null ? "—" : euro(info.viaTellers)}
        />
        <Cijfer
          label="Verschil dit boekjaar"
          waarde={info.verschil == null ? "—" : euro(info.verschil)}
          sub={
            info.vorigJaarVerschil == null
              ? undefined
              : `vorig boekjaar: ${euro(info.vorigJaarVerschil)}`
          }
        />
        <Cijfer
          label="Voorgesteld extra bedrag"
          waarde={info.voorstel == null ? "—" : euro(info.voorstel)}
          sub="verschil min normale afwijking"
        />
      </div>

      {info.actief && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">Actief</Badge>
          Huurders {euro(info.actief.huurders)} ({info.actief.pctHuurders} %) ·
          Eigenaars {euro(info.actief.eigenaars)}
        </p>
      )}

      <ActionForm
        action={pasHerverdelingToe}
        className="space-y-4"
        hiddenFields={{
          vme_id: vmeId,
          boekjaar_id: boekjaarId,
          categorie: info.categorie,
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Extra bedrag te herverdelen (€)"
            name="bedrag"
            type="number"
            step="0.01"
            min="0"
            required
            value={bedrag}
            onChange={(e) => setBedrag(e.target.value)}
            hint="Standaard het voorgestelde bedrag; pas aan op basis van de vergadering."
          />
          <div className="space-y-1.5">
            <Field
              label="Aandeel huurders (%)"
              name="pct_huurders"
              type="number"
              step="0.1"
              min="0"
              max="100"
              required
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={p === v ? "default" : "outline"}
                  onClick={() => setPct(String(v))}
                >
                  {v} %
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="toelichting">Toelichting (verschijnt bij de kost)</Label>
          <Textarea
            id="toelichting"
            name="toelichting"
            rows={2}
            value={toelichting}
            onChange={(e) => setToelichting(e.target.value)}
          />
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p>
            <strong>Huurders:</strong> {euro(huurders)} — gelijk over de
            appartementen, naar bewoningsdagen (ca.{" "}
            {euro(round2(huurders / info.aantalEigenaars))} per appartement).
          </p>
          <p>
            <strong>Eigenaars:</strong> {euro(eigenaars)} — gelijk verdeeld (
            {euro(round2(eigenaars / info.aantalEigenaars))} per eigenaar).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>
            {info.actief ? "Herverdeling aanpassen" : "Herverdeling toepassen"}
          </SubmitButton>
        </div>
      </ActionForm>

      {info.actief && (
        <ActionForm
          action={verwijderHerverdeling}
          hiddenFields={{ boekjaar_id: boekjaarId, categorie: info.categorie }}
        >
          <ConfirmSubmit
            message="Herverdeling verwijderen? Het extra bedrag valt dan terug op de verbruiksfacturen (niemand rekent het aan)."
            variant="outline"
          >
            Herverdeling verwijderen
          </ConfirmSubmit>
        </ActionForm>
      )}

      <p className="text-xs text-muted-foreground">
        Dit boekt drie rijen die samen €0 zijn (−extra uit verbruik, +deel
        huurders, +deel eigenaars): de totalen per categorie blijven kloppen.
        Na het toepassen de afrekeningen opnieuw berekenen.
      </p>
    </div>
  );
}

function Cijfer({
  label,
  waarde,
  sub,
}: {
  label: string;
  waarde: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{waarde}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
