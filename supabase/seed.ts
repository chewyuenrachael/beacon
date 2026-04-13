/**
 * Seed reference data for local / preview DB (service role).
 * Loads `.env.local` when present.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed(): Promise<void> {
  const { error: instErr } = await supabase.from("institutions").upsert(
    {
      id: "cornell",
      name: "Cornell University",
      country: "United States",
      cs_program_tier: 1,
      sheerid_supported: false,
    },
    { onConflict: "id" }
  );
  if (instErr) throw instErr;

  const { error: profErr } = await supabase.from("professors").upsert(
    {
      id: "sasha-rush",
      institution_id: "cornell",
      name: "Alexander Rush",
      title: "Professor",
      // arxiv_author_id: phrase for au:"…" in fetchRecentPapers; if value contains ':' it is used as full search_query
      arxiv_author_id: "Alexander M Rush",
      recent_relevant_papers_count: 0,
      public_statements: [],
    },
    { onConflict: "id" }
  );
  if (profErr) throw profErr;

  console.log("Seed complete: institution cornell, professor sasha-rush");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
