import { euro } from "@/lib/format";

export interface JaarReeks {
  label: string;
  inkomsten: number;
  uitgaven: number;
}

/** Handgemaakte gegroepeerde staafgrafiek (geen library). */
export function BarChart({ data }: { data: JaarReeks[] }) {
  if (data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen boekjaargegevens om te tonen.
      </p>
    );

  const W = 720;
  const H = 260;
  const padL = 56;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.inkomsten, Math.abs(d.uitgaven))),
  );
  // "mooie" bovengrens
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;

  const groups = data.length;
  const groupW = plotW / groups;
  const barW = Math.min(28, (groupW - 12) / 2);

  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const ticks = 4;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="min-w-[560px] w-full"
        role="img"
        aria-label="Jaarlijkse inkomsten en uitgaven"
      >
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (top / ticks) * i;
          const yy = y(v);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yy}
                y2={yy}
                stroke="var(--border)"
                strokeDasharray={i === 0 ? "0" : "3 3"}
              />
              <text
                x={padL - 8}
                y={yy + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {euro(v).replace(/,00$/, "")}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const gx = padL + i * groupW + groupW / 2;
          return (
            <g key={d.label}>
              <rect
                x={gx - barW - 2}
                y={y(d.inkomsten)}
                width={barW}
                height={Math.max(0, padT + plotH - y(d.inkomsten))}
                rx="3"
                fill="var(--chart-1)"
              />
              <rect
                x={gx + 2}
                y={y(Math.abs(d.uitgaven))}
                width={barW}
                height={Math.max(0, padT + plotH - y(Math.abs(d.uitgaven)))}
                rx="3"
                fill="var(--chart-2)"
              />
              <text
                x={gx}
                y={H - 10}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: "var(--chart-1)" }}
          />
          Inkomsten
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: "var(--chart-2)" }}
          />
          Uitgaven
        </span>
      </div>
    </div>
  );
}
