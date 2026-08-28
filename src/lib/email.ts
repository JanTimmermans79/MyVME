"use client";

import emailjs from "@emailjs/browser";
import { emailjsEnv } from "@/lib/env";

export interface AfrekeningMailParams {
  to_email: string;
  to_name: string;
  vme_naam: string;
  vme_iban: string;
  boekjaar: string;
  unit_naam: string;
  betaler_type: string;
  bedrag: string; // absoluut bedrag, geformatteerd
  richting: string; // "bijbetaling" | "terugbetaling" | "in evenwicht"
  saldo: string; // getekend bedrag, geformatteerd
  [key: string]: string;
}

/**
 * Verstuurt één afrekeningmail via EmailJS. Alleen client-side, en enkel
 * bruikbaar vanuit een ingelogde adminsessie (deze module wordt nooit op een
 * publieke pagina gebruikt).
 */
export async function verstuurAfrekeningMail(
  params: AfrekeningMailParams,
): Promise<void> {
  if (!emailjsEnv.configured) {
    throw new Error(
      "EmailJS is niet geconfigureerd (NEXT_PUBLIC_EMAILJS_*).",
    );
  }
  await emailjs.send(emailjsEnv.serviceId, emailjsEnv.templateId, params, {
    publicKey: emailjsEnv.publicKey,
  });
}

export function emailjsGeconfigureerd(): boolean {
  return emailjsEnv.configured;
}
