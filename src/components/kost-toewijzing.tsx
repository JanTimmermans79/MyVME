"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Eenvoudige toewijzing van een kost: eerst "eigenaars" of "huurders", dan de
 * rubriek. Levert de velden `categorie` en `verdeling` zoals de bestaande
 * server-acties ze verwachten.
 */

type Toewijzing = "huurders" | "eigenaars" | "verbruik";

const HUURDER_RUBRIEKEN = [
  { value: "elektriciteit", label: "Elektriciteit gemeenschap" },
  { value: "schoonmaak", label: "Schoonmaak" },
  { value: "onderhoud", label: "Onderhoud verwarming en water" },
  { value: "diverse", label: "Diverse" },
];

const VERBRUIK_RUBRIEKEN = [
  { value: "koud water", label: "Koud water" },
  { value: "warm water", label: "Warm water" },
  { value: "centrale verwarming", label: "Centrale verwarming" },
  { value: "mazout", label: "Mazout (stookolie)" },
];
const VERBRUIK_NAMEN = new Set(VERBRUIK_RUBRIEKEN.map((r) => r.value));
const HUURDER_NAMEN = new Set(HUURDER_RUBRIEKEN.map((r) => r.value));

const EIGENAAR_BASIS = ["syndicus", "verzekering", "diverse", "grote werken"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function beginToewijzing(verdeling?: string, categorie?: string): Toewijzing {
  if (verdeling === "individueel_verbruik") return "verbruik";
  if (verdeling === "gelijk_eigenaars" || verdeling === "per_quotiteit")
    return "eigenaars";
  if (verdeling === "gelijk_huurders") return "huurders";
  if (categorie && VERBRUIK_NAMEN.has(categorie)) return "verbruik";
  return "huurders";
}

export function KostToewijzing({
  idPrefix = "kt",
  categorieen,
  defaultVerdeling,
  defaultCategorie,
}: {
  idPrefix?: string;
  /** Actieve categorienamen van de VME (voor de rubrieken van de eigenaars). */
  categorieen: string[];
  defaultVerdeling?: string;
  defaultCategorie?: string;
}) {
  const [toewijzing, setToewijzing] = useState<Toewijzing>(
    beginToewijzing(defaultVerdeling, defaultCategorie),
  );
  const [categorie, setCategorie] = useState(
    defaultCategorie ??
      (toewijzing === "huurders" ? "diverse" : EIGENAAR_BASIS[0]),
  );
  const [eigenaarVerdeling, setEigenaarVerdeling] = useState(
    defaultVerdeling === "per_quotiteit" ? "per_quotiteit" : "gelijk_eigenaars",
  );

  const eigenaarRubrieken = [
    ...new Set([
      ...EIGENAAR_BASIS,
      ...categorieen.filter(
        (c) => !VERBRUIK_NAMEN.has(c) && !HUURDER_NAMEN.has(c),
      ),
      ...(defaultCategorie &&
      !VERBRUIK_NAMEN.has(defaultCategorie) &&
      !HUURDER_NAMEN.has(defaultCategorie)
        ? [defaultCategorie]
        : []),
    ]),
  ];

  const rubrieken: { value: string; label: string }[] =
    toewijzing === "huurders"
      ? HUURDER_RUBRIEKEN
      : toewijzing === "verbruik"
        ? VERBRUIK_RUBRIEKEN
        : eigenaarRubrieken.map((c) => ({ value: c, label: cap(c) }));
  // Een categorie die in de nieuwe lijst niet bestaat (bv. na het wisselen van
  // 'ten laste van') verdwijnt uit de keuze; neem dan de eerste rubriek.
  const geldigeCategorie = rubrieken.some((r) => r.value === categorie)
    ? categorie
    : rubrieken[0].value;

  const verdeling =
    toewijzing === "huurders"
      ? "gelijk_huurders"
      : toewijzing === "verbruik"
        ? "individueel_verbruik"
        : eigenaarVerdeling;

  function kies(nieuw: Toewijzing) {
    setToewijzing(nieuw);
    setCategorie(
      nieuw === "huurders"
        ? "diverse"
        : nieuw === "verbruik"
          ? VERBRUIK_RUBRIEKEN[0].value
          : EIGENAAR_BASIS[0],
    );
  }

  return (
    <>
      <input type="hidden" name="categorie" value={geldigeCategorie} />
      <input type="hidden" name="verdeling" value={verdeling} />

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-wie`}>Ten laste van</Label>
        <Select
          value={toewijzing}
          onValueChange={(v) => kies(v as Toewijzing)}
        >
          <SelectTrigger id={`${idPrefix}-wie`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="huurders">Huurders</SelectItem>
            <SelectItem value="eigenaars">Eigenaars</SelectItem>
            <SelectItem value="verbruik">
              Verbruik per appartement (tellers)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-rubriek`}>
          {toewijzing === "huurders" ? "Rubriek huurders" : "Rubriek"}
        </Label>
        <Select value={geldigeCategorie} onValueChange={setCategorie}>
          <SelectTrigger id={`${idPrefix}-rubriek`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rubrieken.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {toewijzing === "eigenaars" && geldigeCategorie === "syndicus" && (
          <p className="text-xs text-muted-foreground">
            Een deel (%) kan aan de huurders doorgerekend worden: zie
            Instellingen → Tarieven &amp; parameters.
          </p>
        )}
      </div>

      {toewijzing === "eigenaars" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-verdeling`}>Verdeling over eigenaars</Label>
          <Select value={eigenaarVerdeling} onValueChange={setEigenaarVerdeling}>
            <SelectTrigger id={`${idPrefix}-verdeling`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gelijk_eigenaars">Gelijk per appartement</SelectItem>
              <SelectItem value="per_quotiteit">
                Per quotiteit (verdeelsleutel)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
