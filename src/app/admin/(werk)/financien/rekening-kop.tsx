import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/vme-context";
import { euro, datum } from "@/lib/format";
import type { VmeRekening } from "@/lib/types";
import { RekeningTabs } from "./rekening-tabs";

export async function RekeningKop({ rekening }: { rekening: VmeRekening }) {
  const { vme, boekjaar } = await getActiveContext();
  if (!vme || !boekjaar) return null;

  const supabase = await createClient();
  const { data: us } = await supabase
    .from("bankuittreksel")
    .select("saldo_begin, saldo_eind")
    .eq("vme_id", vme.id)
    .eq("rekening", rekening)
    .lte("periode_van", boekjaar.eind_datum)
    .gte("periode_tot", boekjaar.start_datum)
    .order("periode_van", { ascending: true });
  const rows = (us ?? []) as { saldo_begin: number | null; saldo_eind: number | null }[];
  const begin = rows[0]?.saldo_begin ?? null;
  const eind = rows[rows.length - 1]?.saldo_eind ?? null;

  const iban = rekening === "spaar" ? vme.iban_reserve : vme.iban;

  return (
    <div className="space-y-3 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {rekening === "spaar"
              ? "Spaarrekening — kapitaal VME"
              : "Zichtrekening — werkrekening VME"}
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {iban ?? "IBAN niet ingesteld"}
          </p>
        </div>
        <p className="text-sm tabular-nums">
          {begin != null && eind != null ? (
            <>
              Saldo {euro(begin)} → <strong>{euro(eind)}</strong>
            </>
          ) : (
            <span className="text-muted-foreground">geen uittreksel</span>
          )}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Boekjaar {datum(boekjaar.start_datum)} – {datum(boekjaar.eind_datum)}
      </p>
      <RekeningTabs
        basis={`/admin/financien/${rekening}`}
        voorschotLabel={
          rekening === "spaar"
            ? "Voorschotcontrole eigenaars"
            : "Voorschotcontrole huurders"
        }
      />
    </div>
  );
}
