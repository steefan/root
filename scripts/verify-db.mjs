import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (no dependency).
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let ok = true;
const check = (label, pass, detail = "") => {
  console.log(`${pass ? "✓" : "✗"} ${label}${detail ? "  — " + detail : ""}`);
  if (!pass) ok = false;
};

for (const table of ["profiles", "companions", "messages", "memories"]) {
  const { error } = await supabase.from(table).select("id").limit(1);
  check(`table ${table}`, !error, error?.message ?? "");
}

{
  const { error } = await supabase.rpc("due_proactive_companions");
  check("rpc due_proactive_companions", !error, error?.message ?? "");
}

{
  // match_memories needs a 1536-dim vector; just confirm the function exists
  // (a dimension/most errors are fine — "function does not exist" is the fail).
  const { error } = await supabase.rpc("match_memories", {
    p_companion_id: "00000000-0000-0000-0000-000000000000",
    p_query_embedding: Array(1536).fill(0),
    p_match_count: 1,
  });
  const missing = error?.message?.includes("Could not find the function");
  check("rpc match_memories", !missing, error?.message ?? "");
}

{
  const { data, error } = await supabase.storage.listBuckets();
  const hasMedia = data?.some((b) => b.id === "media");
  check("storage bucket 'media'", !error && hasMedia, error?.message ?? "");
}

console.log(ok ? "\nALL_GOOD" : "\nHAS_FAILURES");
process.exit(ok ? 0 : 1);
