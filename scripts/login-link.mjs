/**
 * Genereert een directe aanmeld-URL zonder e-mail te versturen (handig als je
 * tegen de Supabase e-mail-rate-limit aanloopt tijdens het testen).
 *
 *   node scripts/login-link.mjs <email> [site-url]
 *
 * <email>     account om mee aan te melden (wordt aangemaakt als het nog niet bestaat)
 * [site-url]  bv. https://myvme.vercel.app  (default: NEXT_PUBLIC_SITE_URL uit .env.local)
 *
 * Plak de geprinte URL in je browser -> je bent ingelogd.
 * De link is ~1 uur geldig en eenmalig bruikbaar.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(
  new URL("../.env.local", import.meta.url),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const email = process.argv[2];
const siteUrl = (process.argv[3] ?? env.NEXT_PUBLIC_SITE_URL ?? "").replace(
  /\/$/,
  "",
);

if (!email || !siteUrl) {
  console.error("Gebruik: node scripts/login-link.mjs <email> [site-url]");
  process.exit(1);
}

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// zorg dat de gebruiker bestaat
const list = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
let user = list.data.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);
if (!user) {
  const created = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.error) {
    console.error("Kon gebruiker niet aanmaken:", created.error.message);
    process.exit(1);
  }
  user = created.data.user;
  console.log("Nieuwe gebruiker aangemaakt:", email);
}

const { data, error } = await sb.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (error) {
  console.error("generateLink-fout:", error.message);
  process.exit(1);
}

const hashed = data.properties.hashed_token;
// token_hash-verificatie via GoTrue verwacht type=email (niet 'magiclink')
const loginUrl = `${siteUrl}/auth/callback?token_hash=${hashed}&type=email`;

console.log("\nAanmeld-URL (plak in je browser):\n");
console.log(loginUrl);
console.log(
  "\nWil je meteen admin zijn? Draai daarna in de Supabase SQL Editor:",
);
console.log(
  `  update public.profiles set is_admin = true where email = '${email}';`,
);
