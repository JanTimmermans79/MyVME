"use client";

import { euro } from "@/lib/format";

export interface Punt {
  boekjaar_id: string;
  label: string;
  waarde: number | null;
}

export const m3 = (n: number) =>
  `${n.toLocaleString("nl-BE", { maximumFractionDigits: 1 })} m³`;

/**
 * Eenvoudige SVG-lijngrafiek over de boekjaren. Lege punten (`waarde === null`)
 * breken de lijn. Gedeeld door de admin-EvolutieGrafiek en de eigenaars-
 * VerbruikGrafiek.
 */
export function LijnGrafiek({
  punten,
  euroAs,
}: {
  punten: Punt[];
  euroAs: boolean;
}) {
  const vals = punten
    .map((p) => p.waarde)
    .filter((v): v is number => v != null);

  if (vals.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen gegevens voor deze reeks.
      </p>
    );

  const W = 720;
  const H = 260;
  const padL = 64;
  const padR = 14;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const rawMax = Math.max(0, ...vals);
  const rawMin = Math.min(0, ...vals);
  const span = Math.max(1, rawMax - rawMin);
  const step = Math.pow(10, Math.floor(Math.log10(span)));
  const top = Math.ceil(rawMax / step) * step || step;
  const bot = Math.floor(rawMin / step) * step;
  const range = Math.max(1, top - bot);

  const n = punten.length;
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - ((v - bot) / range) * plotH;

  const ticks = 4;
  const fmtTick = (v: number) =>
    euroAs ? euro(v).replace(/,00$/, "") : v.toLocaleString("nl-BE");

  // Lijnsegmenten enkel tussen opeenvolgende niet-lege punten.
  const segmenten: string[] = [];
  let lopend: string[] = [];
  punten.forEach((p, i) => {
    if (p.waarde == null) {
      if (lopend.length) segmenten.push(lopend.join(" "));
      lopend = [];
    } else {
      lopend.push(`${x(i)},${y(p.waarde)}`);
    }
  });
  if (lopend.length) segmenten.push(lopend.join(" "));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Evolutie over de boekjaren"
      >
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = bot + (range / ticks) * i;
          const yy = y(v);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yy}
                y2={yy}
                stroke="var(--border)"
                strokeDasharray={Math.abs(v) < 0.001 ? "0" : "3 3"}
              />
              <text
                x={padL - 8}
                y={yy + 4}
                textAnchor="end"
                fontSize="10"
                className="fill-muted-foreground"
              >
                {fmtTick(v)}
              </text>
            </g>
          );
        })}

        {segmenten.map((pts, i) => (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="2"
          />
        ))}

        {punten.map((p, i) =>
          p.waarde == null ? null : (
            <g key={p.boekjaar_id}>
              <circle cx={x(i)} cy={y(p.waarde)} r="3.5" fill="var(--chart-1)" />
              <title>{`${p.label} — ${euroAs ? euro(p.waarde) : m3(p.waarde)}`}</title>
            </g>
          ),
        )}

        {punten.map((p, i) => (
          <text
            key={`l-${p.boekjaar_id}`}
            x={x(i)}
            y={H - 9}
            textAnchor="middle"
            fontSize="10"
            className="fill-muted-foreground"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
