import { config } from 'dotenv';
config({ path: '.env.local' });

const args = process.argv.slice(2);
const which = args[0];

console.log(`[test] starting scraper: ${which}`);
console.time(`[test] ${which}`);

try {
  if (which === "devpost") {
    const { discoverFromDevpost } = await import("../lib/sources/devpost.ts");
    const result = await discoverFromDevpost();
    console.log(`[test] devpost: ${result.length} drafts`);
    console.log(JSON.stringify(result.slice(0, 2), null, 2));
  } else if (which === "github") {
    const { discoverFromGitHubStudents } = await import("../lib/sources/github-students.ts");
    const result = await discoverFromGitHubStudents();
    console.log(`[test] github: ${result.length} drafts`);
    console.log(JSON.stringify(result.slice(0, 2), null, 2));
  } else if (which === "arxiv") {
    const { discoverFromArxivUndergrads } = await import("../lib/sources/arxiv-undergrads.ts");
    const result = await discoverFromArxivUndergrads();
    console.log(`[test] arxiv: ${result.length} drafts`);
    console.log(JSON.stringify(result.slice(0, 2), null, 2));
  } else {
    console.log("Usage: pnpm tsx scripts/test-scrapers.mts [devpost|github|arxiv]");
  }
} catch (e) {
  console.error(`[test] ${which} ERRORED:`, e);
}

console.timeEnd(`[test] ${which}`);
