import { euro } from "@/lib/format";

const PALETTE = [
  "oklch(0.51 0.226 277)",
  "oklch(0.62 0.2 20)",
  "oklch(0.7 0.15 165)",
  "oklch(0.75 0.15 75)",
  "oklch(0.62 0.18 300)",
  "oklch(0.6 0.13 230)",
  "oklch(0.68 0.17 130)",
  "oklch(0.6 0.1 30)",
  "oklch(0.55 0.05 260)",
];

export interface StackedJaar {
  label: string;
  perCategorie: Record<string, number>;
}

export function StackedBarChart({
  categorieen,
  jaren,
}: {
  categorieen: string[];
  jaren: StackedJaar[];
}) {
  if (jaren.length === 0 || categorieen.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Nog geen kosten geboekt.</p>
    );

  const kleur = (c: string) =>
    PALETTE[categorieen.indexOf(c) % PALETTE.length];

  const W = 640;
  const H = 240;
  const padL = 56;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const plotH = H - padT - padB;
  const plotW = W - padL - padR;

  const totalen = jaren.map((j) =>
    categorieen.reduce((s, c) => s + Math.max(0, j.perCategorie[c] ?? 0), 0),
  );
  const max = Math.max(1, ...totalen);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;

  const groupW = plotW / jaren.length;
  const barW = Math.min(48, groupW - 16);
  const y = (v: number) => padT + plotH - (v / top) * plotH;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="min-w-[480px] w-full"
          role="img"
          aria-label="Gedeelde kosten per categorie per boekjaar"
        >
          {Array.from({ length: 5 }, (_, i) => {
            const v = (top / 4) * i;
            return (
              <g key={i}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--border)"
                  strokeDasharray={i === 0 ? "0" : "3 3"}
                />
                <text
                  x={padL - 8}
                  y={y(v) + 4}
                  textAnchor="end"
                  fontSize="10"
                  className="fill-muted-foreground"
                >
                  {euro(v).replace(/,00$/, "")}
                </text>
              </g>
            );
          })}

          {jaren.map((j, gi) => {
            const gx = padL + gi * groupW + (groupW - barW) / 2;
            let acc = 0;
            return (
              <g key={j.label}>
                {categorieen.map((c) => {
                  const val = Math.max(0, j.perCategorie[c] ?? 0);
                  if (val === 0) return null;
                  const y0 = y(acc + val);
                  const h = y(acc) - y0;
                  acc += val;
                  return (
                    <rect
                      key={c}
                      x={gx}
                      y={y0}
                      width={barW}
                      height={h}
                      fill={kleur(c)}
                    >
                      <title>{`${c} — ${euro(val)}`}</title>
                    </rect>
                  );
                })}
                <text
                  x={gx + barW / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="10"
                  className="fill-muted-foreground"
                >
                  {j.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {categorieen.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: kleur(c) }}
            />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
