/**
 * Seed reference data for local / preview DB (service role).
 * Loads `.env.local` when present.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { computeAmbassadorScoreFromApplicationData } from "../lib/ambassador-scoring";
import type { AmbassadorApplicationData } from "../lib/types/ambassador";

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

const AMB_MIT = "11111111-1111-4111-8111-111111111111";
const AMB_STANFORD = "22222222-2222-4222-8222-222222222222";
const AMB_CMU = "33333333-3333-4333-8333-333333333333";

async function seed(): Promise<void> {
  const { error: instErr } = await supabase.from("institutions").upsert(
    [
      {
        id: "cornell",
        name: "Cornell University",
        country: "United States",
        cs_program_tier: 1,
        sheerid_supported: false,
      },
      {
        id: "mit",
        name: "MIT",
        country: "United States",
        cs_program_tier: 1,
        sheerid_supported: true,
      },
      {
        id: "stanford",
        name: "Stanford University",
        country: "United States",
        cs_program_tier: 1,
        sheerid_supported: true,
      },
      {
        id: "cmu",
        name: "Carnegie Mellon University",
        country: "United States",
        cs_program_tier: 1,
        sheerid_supported: true,
      },
      {
        id: "oxford",
        name: "University of Oxford",
        country: "United Kingdom",
        cs_program_tier: 1,
        sheerid_supported: true,
      },
    ],
    { onConflict: "id" }
  );
  if (instErr) throw instErr;

  const { error: profErr } = await supabase.from("professors").upsert(
    {
      id: "sasha-rush",
      institution_id: "cornell",
      name: "Alexander Rush",
      title: "Professor",
      arxiv_author_id: "Alexander M Rush",
      recent_relevant_papers_count: 0,
      public_statements: [],
    },
    { onConflict: "id" }
  );
  if (profErr) throw profErr;

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

  const mitApp: AmbassadorApplicationData = {
    why_cursor:
      "I research LLMs and software engineering; Cursor is central to how our lab teaches AI-assisted programming and productivity.",
    past_community_work:
      "President of the campus ACM chapter; organized weekly workshops and mentored 40+ students in open source.",
    proposed_events:
      "Monthly Cafe Cursor, one major hackathon sponsorship, and faculty lunch-and-learn on AI coding tools.",
    expected_reach: "450 students per semester across CS and DS majors.",
  };
  const mitScore = computeAmbassadorScoreFromApplicationData(mitApp);

  const stanfordApp: AmbassadorApplicationData = {
    why_cursor: "I want to bring Cursor to more students on campus.",
    past_community_work: "Helped at a few club meetings.",
    proposed_events: "Maybe a workshop next quarter.",
    expected_reach: "50",
  };
  const stanfordScore = computeAmbassadorScoreFromApplicationData(stanfordApp);

  const cmuApp: AmbassadorApplicationData = {
    why_cursor:
      "Former heavy user; interested in reviving adoption after a quieter year for our chapter.",
    past_community_work:
      "Past hackathon organizer; stepped back from leadership last year.",
    proposed_events: "One resume workshop if schedule allows.",
    expected_reach: "80",
  };
  const cmuScore = computeAmbassadorScoreFromApplicationData(cmuApp);

  async function seedAmbassadorIfMissing(params: {
    id: string;
    institution_id: string;
    email: string;
    name: string;
    github_username: string | null;
    application_data: AmbassadorApplicationData;
    score: ReturnType<typeof computeAmbassadorScoreFromApplicationData>;
    stage: string;
    health_score: number;
    accepted_at: string | null;
    last_active_at: string | null;
    observations: Array<{
      observation_type: string;
      payload: Record<string, unknown>;
      observed_at: string;
    }>;
  }): Promise<void> {
    const { data: existing } = await supabase
      .from("ambassadors")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();
    if (existing) return;

    const obsRows = params.observations.map((o) => ({
      entity_type: "ambassador" as const,
      entity_id: params.id,
      observation_type: o.observation_type,
      payload: o.payload,
      source: "manual" as const,
      confidence: 1.0,
      observed_at: o.observed_at,
    }));

    const { error: obsErr } = await supabase.from("observations").insert(obsRows);
    if (obsErr) throw obsErr;

    const { error: ambErr } = await supabase.from("ambassadors").insert({
      id: params.id,
      institution_id: params.institution_id,
      email: params.email,
      name: params.name,
      github_username: params.github_username,
      application_data: params.application_data,
      score: params.score,
      stage: params.stage,
      health_score: params.health_score,
      accepted_at: params.accepted_at,
      last_active_at: params.last_active_at,
    });
    if (ambErr) throw ambErr;

    const { error: actErr } = await supabase.from("ambassador_activity").insert({
      ambassador_id: params.id,
      activity_type: "application_submitted",
      payload: { source: "seed" },
    });
    if (actErr) throw actErr;
  }

  await seedAmbassadorIfMissing({
    id: AMB_MIT,
    institution_id: "mit",
    email: "mit-ambassador@example.edu",
    name: "Jordan Kim",
    github_username: "jordan-kim-mit",
    application_data: mitApp,
    score: mitScore,
    stage: "active",
    health_score: 82,
    accepted_at: "2025-02-15T18:00:00.000Z",
    last_active_at: "2026-04-08T15:30:00.000Z",
    observations: [
      {
        observation_type: "ambassador_applied",
        payload: {
          name: "Jordan Kim",
          email: "mit-ambassador@example.edu",
          institution_id: "mit",
          application_data: mitApp,
        },
        observed_at: "2025-02-01T12:00:00.000Z",
      },
      {
        observation_type: "ambassador_scored",
        payload: { ...mitScore },
        observed_at: "2025-02-01T12:01:00.000Z",
      },
      {
        observation_type: "ambassador_accepted",
        payload: {
          from_stage: "under_review",
          to_stage: "accepted",
          name: "Jordan Kim",
        },
        observed_at: "2025-02-10T10:00:00.000Z",
      },
      {
        observation_type: "ambassador_activity_logged",
        payload: {
          from_stage: "onboarding",
          to_stage: "active",
        },
        observed_at: "2025-02-20T09:00:00.000Z",
      },
      {
        observation_type: "ambassador_health_computed",
        payload: {
          health_score: 82,
          observations_last_90d: 6,
          events_last_90d: 0,
          days_since_last_active: 5,
        },
        observed_at: "2026-04-08T16:00:00.000Z",
      },
    ],
  });

  await seedAmbassadorIfMissing({
    id: AMB_STANFORD,
    institution_id: "stanford",
    email: "stanford-apply@example.edu",
    name: "Alex Rivera",
    github_username: null,
    application_data: stanfordApp,
    score: stanfordScore,
    stage: "applied",
    health_score: 0,
    accepted_at: null,
    last_active_at: null,
    observations: [
      {
        observation_type: "ambassador_applied",
        payload: {
          name: "Alex Rivera",
          email: "stanford-apply@example.edu",
          institution_id: "stanford",
          application_data: stanfordApp,
        },
        observed_at: "2026-04-10T14:00:00.000Z",
      },
      {
        observation_type: "ambassador_scored",
        payload: { ...stanfordScore },
        observed_at: "2026-04-10T14:01:00.000Z",
      },
    ],
  });

  await seedAmbassadorIfMissing({
    id: AMB_CMU,
    institution_id: "cmu",
    email: "cmu-ambassador@example.edu",
    name: "Sam Patel",
    github_username: "spatel-cmu",
    application_data: cmuApp,
    score: cmuScore,
    stage: "slowing",
    health_score: 28,
    accepted_at: "2024-09-01T12:00:00.000Z",
    last_active_at: "2025-11-20T18:00:00.000Z",
    observations: [
      {
        observation_type: "ambassador_applied",
        payload: {
          name: "Sam Patel",
          email: "cmu-ambassador@example.edu",
          institution_id: "cmu",
          application_data: cmuApp,
        },
        observed_at: "2024-08-15T12:00:00.000Z",
      },
      {
        observation_type: "ambassador_scored",
        payload: { ...cmuScore },
        observed_at: "2024-08-15T12:02:00.000Z",
      },
      {
        observation_type: "ambassador_accepted",
        payload: {
          from_stage: "under_review",
          to_stage: "accepted",
          name: "Sam Patel",
        },
        observed_at: "2024-08-25T10:00:00.000Z",
      },
      {
        observation_type: "ambassador_activity_logged",
        payload: { from_stage: "active", to_stage: "slowing" },
        observed_at: "2026-01-05T11:00:00.000Z",
      },
      {
        observation_type: "ambassador_health_computed",
        payload: {
          health_score: 28,
          observations_last_90d: 1,
          events_last_90d: 0,
          days_since_last_active: 145,
        },
        observed_at: "2026-04-09T08:00:00.000Z",
      },
    ],
  });

  console.log(
    "Seed complete: 5 institutions (cornell, mit, stanford, cmu, oxford), 1 professor (sasha-rush), 5 verification_attempts, 3 ambassadors"
  );
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});