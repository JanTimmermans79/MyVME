/**
 * Gecentraliseerde toegang tot environment-variabelen.
 *
 * BELANGRIJK: Next.js vervangt `process.env.NEXT_PUBLIC_*` in de browser-bundle
 * enkel bij *directe* member-access (niet via `process.env[naam]`). Daarom staat
 * elke NEXT_PUBLIC_-variabele hieronder letterlijk uitgeschreven.
 *
 * De accessors gooien pas een fout wanneer een ontbrekende waarde écht nodig is,
 * niet bij het laden van de module — zo blijft `next build` werken.
 */

function ensure(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Ontbrekende environment-variabele: ${name}. Zie .env.example.`,
    );
  }
  return value;
}

export const clientEnv = {
  get supabaseUrl() {
    return ensure(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey() {
    return ensure(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
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

/** Alleen aanroepen vanuit server-code (service_role key is server-only). */
export function serverEnv() {
  return {
    supabaseUrl: ensure(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    serviceRoleKey: ensure(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}
