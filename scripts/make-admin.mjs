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
if (!email) {
  console.error("Gebruik: node scripts/make-admin.mjs <email>");
  process.exit(1);
}
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await sb
  .from("profiles")
  .update({ is_admin: true })
  .eq("email", email)
  .select();

if (error) {
  console.error("Fout:", error.message);
  process.exit(1);
}
console.log(
  data?.length
    ? `OK — ${email} is nu syndicus (is_admin=true).`
    : `Geen profiel gevonden voor ${email}. Log eerst één keer in.`,
);
