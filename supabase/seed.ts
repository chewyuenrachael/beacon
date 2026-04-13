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

  const { error: stanfordInstErr } = await supabase.from("institutions").upsert(
    {
      id: "stanford",
      name: "Stanford University",
      country: "United States",
      cs_program_tier: 1,
      sheerid_supported: true,
    },
    { onConflict: "id" }
  );
  if (stanfordInstErr) throw stanfordInstErr;

  const { error: oxfordInstErr } = await supabase.from("institutions").upsert(
    {
      id: "oxford",
      name: "University of Oxford",
      country: "United Kingdom",
      cs_program_tier: 1,
      sheerid_supported: true,
    },
    { onConflict: "id" }
  );
  if (oxfordInstErr) throw oxfordInstErr;

  const verificationRows = [
    {
      id: "a1000000-0000-4000-8000-000000000001",
      email: "student@stanford.edu",
      country: "United States",
      claimed_institution: "Stanford University",
      sheerid_response_code: "success",
      status: "approved",
      reviewed_by: "campus-lead",
      reviewed_at: new Date().toISOString(),
      notes: null as string | null,
    },
    {
      id: "a1000000-0000-4000-8000-000000000002",
      email: "priya@iit.example.in",
      country: "India",
      claimed_institution: "IIT Delhi",
      sheerid_response_code: "country_unsupported",
      status: "pending",
      reviewed_by: null as string | null,
      reviewed_at: null as string | null,
      notes: null as string | null,
    },
    {
      id: "a1000000-0000-4000-8000-000000000003",
      email: "andrei@university.ro",
      country: "Romania",
      claimed_institution: "University of Bucharest",
      sheerid_response_code: "country_unsupported",
      status: "pending",
      reviewed_by: null as string | null,
      reviewed_at: null as string | null,
      notes: null as string | null,
    },
    {
      id: "a1000000-0000-4000-8000-000000000004",
      email: "chiaraj@ox.ac.uk",
      country: "United Kingdom",
      claimed_institution: "University of Oxford",
      sheerid_response_code: "success",
      status: "manual_review",
      reviewed_by: null as string | null,
      reviewed_at: null as string | null,
      notes: null as string | null,
    },
    {
      id: "a1000000-0000-4000-8000-000000000005",
      email: "applicant@gmail.com",
      country: "United States",
      claimed_institution: null as string | null,
      sheerid_response_code: "email_domain_mismatch",
      status: "rejected",
      reviewed_by: "campus-lead",
      reviewed_at: new Date().toISOString(),
      notes: "Consumer email domain — not eligible for edu discount.",
    },
  ];

  const { error: verErr } = await supabase
    .from("verification_attempts")
    .upsert(verificationRows, { onConflict: "id" });
  if (verErr) throw verErr;

  console.log(
    "Seed complete: cornell/sasha-rush, stanford/oxford institutions, 5 verification_attempts"
  );
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
