import { config } from 'dotenv';
config({ path: '.env.local' });

const args = process.argv.slice(2);
const which = args[0];
const TIMEOUT_MS = 60_000;

console.log(`[test] starting scraper: ${which}`);
console.time(`[test] ${which}`);

// Patch fetch to log every call
const originalFetch = global.fetch;
let fetchCount = 0;
global.fetch = (async (url: any, opts: any) => {
  fetchCount++;
  const callId = fetchCount;
  console.log(`[fetch #${callId}] -> ${url}`);
  const start = Date.now();
  try {
    const res = await originalFetch(url, opts);
    console.log(`[fetch #${callId}] <- ${res.status} (${Date.now()-start}ms)`);
    return res;
  } catch (e) {
    console.log(`[fetch #${callId}] ERROR (${Date.now()-start}ms):`, e);
    throw e;
  }
}) as any;

const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error(`TIMEOUT after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
);

try {
  const work = (async () => {
    if (which === "devpost") {
      const { discoverFromDevpost } = await import("../lib/sources/devpost.ts");
      return discoverFromDevpost();
    } else if (which === "github") {
      const { discoverFromGitHubStudents } = await import("../lib/sources/github-students.ts");
      return discoverFromGitHubStudents();
    } else if (which === "arxiv") {
      const { discoverFromArxivUndergrads } = await import("../lib/sources/arxiv-undergrads.ts");
      return discoverFromArxivUndergrads();
    }
    throw new Error("Usage: pnpm tsx scripts/test-scrapers.mts [devpost|github|arxiv]");
  })();

  const result = await Promise.race([work, timeout]) as any[];
  console.log(`[test] ${which}: ${result.length} drafts`);
  console.log(JSON.stringify(result.slice(0, 2), null, 2));
} catch (e) {
  console.error(`[test] ${which} ERRORED:`, e);
}

console.log(`[test] total fetches: ${fetchCount}`);
console.timeEnd(`[test] ${which}`);
process.exit(0);
