"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { euro, datum, saldoRichting } from "@/lib/format";
import {
  verstuurAfrekeningMail,
  emailjsGeconfigureerd,
  type AfrekeningMailParams,
} from "@/lib/email";
import { recordMail } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AfrekeningRij {
  id: string;
  unit_id: string;
  unit_naam: string;
  betaler_type: string;
  verschuldigd: number;
  ontvangen: number;
  saldo: number;
  ontvanger_naam: string;
  ontvanger_email: string | null;
  mail_verzonden_op: string | null;
  mail_status: string | null;
  reservefonds_ontvangen?: number;
  kapitaalopvraging?: number;
}


export function AfrekeningTabel({
  rijen,
  context,
}: {
  rijen: AfrekeningRij[];
  context: {
    vme_naam: string;
    vme_iban: string;
    boekjaar: string;
    boekjaar_id: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const configured = useMemo(() => emailjsGeconfigureerd(), []);

  function buildParams(r: AfrekeningRij): AfrekeningMailParams {
    const richting = saldoRichting(r.saldo);
    return {
      to_email: r.ontvanger_email ?? "",
      to_name: r.ontvanger_naam,
      vme_naam: context.vme_naam,
      vme_iban: context.vme_iban,
      boekjaar: context.boekjaar,
      unit_naam: r.unit_naam,
      betaler_type: r.betaler_type,
      bedrag: euro(Math.abs(r.saldo)),
      richting: richting.bijbetaling
        ? "bijbetaling"
        : r.saldo > 0
          ? "terugbetaling"
          : "in evenwicht",
      saldo: euro(r.saldo),
    };
  }

  async function verstuur(r: AfrekeningRij) {
    if (!r.ontvanger_email) {
      toast.error(`Geen e-mailadres voor ${r.ontvanger_naam}.`);
      return;
    }
    setBusy(r.id);
    try {
      await verstuurAfrekeningMail(buildParams(r));
      const fd = new FormData();
      fd.set("afrekening_id", r.id);
      fd.set("status", "verzonden");
      await recordMail({ ok: false }, fd);
      toast.success(`Verzonden naar ${r.ontvanger_email}`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Versturen mislukt.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function verstuurAlle() {
    const openstaand = rijen.filter(
      (r) => !r.mail_verzonden_op && r.ontvanger_email,
    );
    for (const r of openstaand) {
      await verstuur(r);
    }
  }

  return (
    <div className="space-y-3">
      {!configured && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          EmailJS is nog niet geconfigureerd. Vul de <code>NEXT_PUBLIC_EMAILJS_*</code>{" "}
          variabelen in om afrekeningen te kunnen versturen.
        </p>
      )}
      <div className="flex justify-end">
        <Button
          onClick={verstuurAlle}
          disabled={!configured || busy !== null}
          size="sm"
        >
          Verstuur alle openstaande
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Appartement</TableHead>
              <TableHead>Eigenaar</TableHead>
              <TableHead className="text-right">Reservefonds</TableHead>
              <TableHead className="text-right">
                Aandeel eigenaarskosten
              </TableHead>
              <TableHead className="text-right">Kapitaalopvraging</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Mail</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rijen.map((r) => {
              const richting = saldoRichting(r.saldo);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/admin/afrekeningen/eigenaar/${r.unit_id}?boekjaar=${context.boekjaar_id}`}
                      className="font-medium hover:underline"
                    >
                      {r.unit_naam}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.ontvanger_naam}
                    <br />
                    <span className="text-muted-foreground">
                      {r.ontvanger_email ?? "geen e-mail"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.reservefonds_ontvangen ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.verschuldigd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(r.kapitaalopvraging ?? 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={richting.bijbetaling ? "destructive" : "secondary"}
                    >
                      {euro(r.saldo)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.mail_verzonden_op
                      ? `${datum(r.mail_verzonden_op)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !configured || busy === r.id || !r.ontvanger_email
                      }
                      onClick={() => verstuur(r)}
                    >
                      {busy === r.id
                        ? "Bezig…"
                        : r.mail_verzonden_op
                          ? "Opnieuw"
                          : "Verstuur"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
