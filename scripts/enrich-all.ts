/**
 * Bulk professor enrichment (arXiv). Run with: npm run enrich-all
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { enrichProfessor } from "../lib/professor-enrichment";

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

const DELAY_BETWEEN_PROFESSORS_MS = 5000;
const RATE_LIMIT_BACKOFFS_MS = [30_000, 60_000, 120_000];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimited(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b/.test(msg) || /HTTP\s*429/i.test(msg);
}

async function enrichWithBackoff(professorId: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFFS_MS.length; attempt++) {
    try {
      await enrichProfessor(professorId);
      return;
    } catch (e) {
      lastErr = e;
      if (isRateLimited(e) && attempt < RATE_LIMIT_BACKOFFS_MS.length) {
        const wait = RATE_LIMIT_BACKOFFS_MS[attempt]!;
        console.warn(
          `[enrich-all] ${professorId}: rate limited, retry in ${wait / 1000}s (attempt ${attempt + 1})`
        );
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function main(): Promise<void> {
  const { data: rows, error } = await supabase
    .from("professors")
    .select("id")
    .order("id", { ascending: true });

  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.id as string);
  console.log(`[enrich-all] ${ids.length} professors to enrich`);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    console.log(`[enrich-all] (${i + 1}/${ids.length}) start ${id}`);
    try {
      await enrichWithBackoff(id);
      console.log(`[enrich-all] (${i + 1}/${ids.length}) done ${id}`);
    } catch (e) {
      console.error(
        `[enrich-all] (${i + 1}/${ids.length}) FAILED ${id}:`,
        e instanceof Error ? e.message : e
      );
    }
    if (i < ids.length - 1) {
      await sleep(DELAY_BETWEEN_PROFESSORS_MS);
    }
  }

  console.log("[enrich-all] finished");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
