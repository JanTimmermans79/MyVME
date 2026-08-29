"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { euro, saldoRichting } from "@/lib/format";
import { emailjsGeconfigureerd } from "@/lib/email";
import emailjs from "@emailjs/browser";
import { emailjsEnv } from "@/lib/env";
import { recordMail } from "../../actions";
import { Button } from "@/components/ui/button";

export interface HuurderMailData {
  afrekening_id: string | null;
  to_email: string | null;
  to_name: string;
  vme_naam: string;
  vme_iban: string;
  periode: string;
  unit_naam: string;
  lijnen_tekst: string;
  totaal_kosten: number;
  voorschot_ontvangen: number;
  saldo: number;
}

export function HuurderAfrekeningVerstuur({ data }: { data: HuurderMailData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const configured = useMemo(() => emailjsGeconfigureerd(), []);
  const r = saldoRichting(data.saldo);

  async function verstuur() {
    if (!data.to_email) {
      toast.error("Deze huurder heeft geen e-mailadres.");
      return;
    }
    if (!data.afrekening_id) {
      toast.error(
        "Sla de afrekening eerst op via “(her)berekenen” op de afrekeningenpagina.",
      );
      return;
    }
    setBusy(true);
    try {
      await emailjs.send(
        emailjsEnv.serviceId,
        emailjsEnv.templateId,
        {
          to_email: data.to_email,
          to_name: data.to_name,
          vme_naam: data.vme_naam,
          vme_iban: data.vme_iban,
          boekjaar: data.periode,
          unit_naam: data.unit_naam,
          betaler_type: "huurder",
          detail: data.lijnen_tekst,
          bedrag: euro(Math.abs(data.saldo)),
          richting: r.bijbetaling
            ? "bijbetaling"
            : data.saldo > 0
              ? "terugbetaling"
              : "in evenwicht",
          saldo: euro(data.saldo),
        },
        { publicKey: emailjsEnv.publicKey },
      );
      const fd = new FormData();
      fd.set("afrekening_id", data.afrekening_id);
      fd.set("status", "verzonden");
      await recordMail({ ok: false }, fd);
      toast.success(`Verzonden naar ${data.to_email}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Versturen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {!configured && (
        <p className="text-xs text-muted-foreground">
          EmailJS niet geconfigureerd — versturen uitgeschakeld.
        </p>
      )}
      <Button
        onClick={verstuur}
        disabled={!configured || busy || !data.to_email}
        size="sm"
      >
        {busy ? "Bezig…" : "Afrekening mailen naar huurder"}
      </Button>
    </div>
  );
}
