/**
 * Beacon eval: 20-professor recent_relevant_papers_count vs fixture.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (and anon for RLS if needed).
 * Run: npm run eval
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { enrichProfessor } from "@/lib/professor-enrichment";

const EVAL_ROOT = resolve(process.cwd(), "tests/evals");

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

const BETWEEN_PROFESSORS_MS = 3000;
const ACCURACY_THRESHOLD = 0.8;
const TOLERANCE = 1;

interface FixtureProfessor {
  id: string;
  institution_id: string;
  name: string;
  arxiv_author_id: string;
  expected_count: number;
  verify_needed?: boolean;
  notes: string;
}

interface FixtureFile {
  professors: FixtureProfessor[];
}

interface RowResult {
  id: string;
  name: string;
  expected: number;
  actual: number | null;
  diff: number | null;
  match: boolean | null;
  verify_needed: boolean;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isoFilename(): string {
  return new Date().toISOString().replace(/:/g, "-");
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)."
    );
    process.exit(1);
  }

  const fixturePath = resolve(EVAL_ROOT, "professors-20.json");
  const raw = readFileSync(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as FixtureFile;
  const professors = fixture.professors;
  if (!Array.isArray(professors) || professors.length === 0) {
    console.error("Invalid fixture: professors[] required");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const institutions = [
    {
      id: "mit",
      name: "MIT",
      country: "United States",
      cs_program_tier: 1,
      sheerid_supported: false,
    },
    {
      id: "stanford",
      name: "Stanford University",
      country: "United States",
      cs_program_tier: 1,
      sheerid_supported: false,
    },
    {
      id: "cmu",
      name: "Carnegie Mellon University",
      country: "United States",
      cs_program_tier: 1,
      sheerid_supported: false,
    },
    {
      id: "berkeley",
      name: "UC Berkeley",
      country: "United States",
      cs_program_tier: 1,
      sheerid_supported: false,
    },
    {
      id: "columbia",
      name: "Columbia University",
      country: "United States",
      cs_program_tier: 1,
      sheerid_supported: false,
    },
  ];

  for (const inst of institutions) {
    const { error } = await supabase.from("institutions").upsert(inst, {
      onConflict: "id",
    });
    if (error) throw new Error(`institution upsert ${inst.id}: ${error.message}`);
  }

  for (const p of professors) {
    const { error } = await supabase.from("professors").upsert(
      {
        id: p.id,
        institution_id: p.institution_id,
        name: p.name,
        arxiv_author_id: p.arxiv_author_id,
        recent_relevant_papers_count: 0,
        public_statements: [],
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`professor upsert ${p.id}: ${error.message}`);
  }

  const rows: RowResult[] = [];
  let evaluated = 0;
  let matched = 0;

  for (let i = 0; i < professors.length; i++) {
    const p = professors[i]!;
    if (i > 0) await sleep(BETWEEN_PROFESSORS_MS);

    const verify = Boolean(p.verify_needed);
    let actual: number | null = null;
    let errMsg: string | undefined;

    try {
      const prof = await enrichProfessor(p.id);
      actual = prof.recent_relevant_papers_count;
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }

    if (verify) {
      rows.push({
        id: p.id,
        name: p.name,
        expected: p.expected_count,
        actual,
        diff:
          actual !== null ? Math.abs(actual - p.expected_count) : null,
        match: null,
        verify_needed: true,
        error: errMsg,
      });
      continue;
    }

    evaluated += 1;
    if (actual === null) {
      rows.push({
        id: p.id,
        name: p.name,
        expected: p.expected_count,
        actual: null,
        diff: null,
        match: false,
        verify_needed: false,
        error: errMsg,
      });
      continue;
    }

    const diff = Math.abs(actual - p.expected_count);
    const ok = diff <= TOLERANCE;
    if (ok) matched += 1;
    rows.push({
      id: p.id,
      name: p.name,
      expected: p.expected_count,
      actual,
      diff,
      match: ok,
      verify_needed: false,
      error: errMsg,
    });
  }

  const accuracy =
    evaluated > 0 ? Math.round((matched / evaluated) * 1000) / 10 : 0;

  console.log("\n=== Beacon eval: professors-20 (recent_relevant_papers_count) ===\n");
  console.log(
    `${"id".padEnd(22)} ${"exp".padStart(4)} ${"act".padStart(4)} ${"diff".padStart(5)}  match  verify`
  );
  console.log("-".repeat(72));
  for (const r of rows) {
    const actStr = r.actual === null ? " — " : String(r.actual).padStart(4);
    const diffStr =
      r.diff === null ? "  — " : String(r.diff).padStart(5);
    const matchStr =
      r.match === null ? "  n/a" : r.match ? "  yes" : "   NO";
    const verStr = r.verify_needed ? "  YES" : "";
    const err = r.error ? ` ERR:${r.error.slice(0, 40)}` : "";
    console.log(
      `${r.id.padEnd(22)} ${String(r.expected).padStart(4)} ${actStr} ${diffStr} ${matchStr}${verStr}${err}`
    );
  }
  console.log("-".repeat(72));
  console.log(
    `\nEvaluated (scored): ${evaluated} / ${professors.length}  |  Matches (|Δ|≤${TOLERANCE}): ${matched}`
  );
  console.log(`Accuracy: ${accuracy}%  (threshold ${ACCURACY_THRESHOLD * 100}%)`);

  const verifyList = rows.filter((r) => r.verify_needed);
  if (verifyList.length) {
    console.log("\nverify_needed (excluded from accuracy):");
    for (const r of verifyList) {
      console.log(`  - ${r.id} (${r.name})`);
    }
  }

  const bad = rows.filter(
    (r) =>
      !r.verify_needed &&
      r.match === false &&
      r.actual !== null &&
      Math.abs(r.actual - r.expected) > TOLERANCE
  );
  if (bad.length) {
    console.log("\nInvestigate (|actual - expected| > 1):");
    for (const r of bad) {
      console.log(
        `  - ${r.id}: expected ${r.expected}, actual ${r.actual}, diff ${r.diff}`
      );
    }
  }

  const resultsDir = resolve(EVAL_ROOT, "results");
  mkdirSync(resultsDir, { recursive: true });
  const outPath = resolve(resultsDir, `${isoFilename()}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        fixture: "professors-20.json",
        tolerance: TOLERANCE,
        evaluated,
        total: professors.length,
        matched,
        accuracy_percent: accuracy,
        pass: accuracy >= ACCURACY_THRESHOLD * 100,
        rows,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\nWrote ${outPath}\n`);

  const pass = accuracy >= ACCURACY_THRESHOLD * 100;
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
