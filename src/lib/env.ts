/**
 * Gecentraliseerde toegang tot environment-variabelen.
 * Client-variabelen (NEXT_PUBLIC_*) worden bij build inlined; server-variabelen
 * zijn enkel beschikbaar in server-code.
 *
 * De accessors gooien pas een fout wanneer een ontbrekende waarde écht nodig is
 * (bij het aanmaken van een client), niet bij het laden van de module — zo blijft
 * `next build` werken in omgevingen waar de secrets nog niet gezet zijn.
 */

function need(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Ontbrekende environment-variabele: ${name}. Zie .env.example.`,
    );
  }
  return value;
}

export const clientEnv = {
  get supabaseUrl() {
    return need("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get siteUrl() {
    return (
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "http://localhost:3000"
    );
  },
};

export const emailjsEnv = {
  get serviceId() {
    return process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? "";
  },
  get templateId() {
    return process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? "";
  },
  get publicKey() {
    return process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? "";
  },
  get configured() {
    return Boolean(this.serviceId && this.templateId && this.publicKey);
  },
};

/** Alleen aanroepen vanuit server-code. */
export function serverEnv() {
  return {
    supabaseUrl: need("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: need("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
