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
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const { data: profiles } = await sb.from("profiles").select("id, email, is_admin");
const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

console.log(`\n${data.users.length} auth-gebruiker(s):\n`);
for (const u of data.users) {
  const p = pmap.get(u.id);
  console.log(
    `  ${u.email}\n    id=${u.id}\n    bevestigd=${!!u.email_confirmed_at}  laatste login=${u.last_sign_in_at ?? "nooit"}\n    profiel: ${p ? `is_admin=${p.is_admin}` : "GEEN PROFIEL-RIJ"}\n`,
  );
}
