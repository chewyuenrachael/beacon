/**
 * One-off: fetch arXiv + keyword count (mirrors professor-enrichment logic).
 * Run: npx tsx tests/evals/scripts/compute-expected-counts.ts
 */
import { subMonths } from "date-fns";
import { fetchRecentPapers } from "@/lib/sources/arxiv";
import { matchPaperKeywords } from "@/lib/keyword-paper-match";

const DELAY_MS = 3000;

function countRecentRelevant(
  papers: Awaited<ReturnType<typeof fetchRecentPapers>>
): number {
  const cutoff = subMonths(new Date(), 24);
  let n = 0;
  for (const paper of papers) {
    const kw = matchPaperKeywords(paper.title, paper.abstract);
    const published = new Date(paper.publishedAt);
    if (
      !Number.isNaN(published.getTime()) &&
      published >= cutoff &&
      kw.matches
    ) {
      n += 1;
    }
  }
  return n;
}

const ROWS: {
  id: string;
  institution_id: string;
  name: string;
  arxiv_author_id: string;
  notes: string;
}[] = [
  {
    id: "regina-barzilay",
    institution_id: "mit",
    name: "Regina Barzilay",
    arxiv_author_id: "Regina Barzilay",
    notes: "NLP, ML for health and molecular design",
  },
  {
    id: "tommi-jaakkola",
    institution_id: "mit",
    name: "Tommi Jaakkola",
    arxiv_author_id: "Tommi Jaakkola",
    notes: "ML theory, generative models, LLM-related work",
  },
  {
    id: "armando-solar-lezama",
    institution_id: "mit",
    name: "Armando Solar-Lezama",
    arxiv_author_id: "Armando Solar-Lezama",
    notes: "Program synthesis, program analysis",
  },
  {
    id: "una-may-oreilly",
    institution_id: "mit",
    name: "Una-May O'Reilly",
    arxiv_author_id: "Una-May O'Reilly",
    notes: "Genetic programming, ML, evolutionary computation",
  },
  {
    id: "christopher-manning",
    institution_id: "stanford",
    name: "Christopher Manning",
    arxiv_author_id: "Christopher Manning",
    notes: "NLP, linguistics, deep learning for language",
  },
  {
    id: "percy-liang",
    institution_id: "stanford",
    name: "Percy Liang",
    arxiv_author_id: "Percy Liang",
    notes: "NLP, foundation models, alignment",
  },
  {
    id: "dan-jurafsky",
    institution_id: "stanford",
    name: "Dan Jurafsky",
    arxiv_author_id: "Dan Jurafsky",
    notes: "NLP, speech, computational social science",
  },
  {
    id: "tatsunori-hashimoto",
    institution_id: "stanford",
    name: "Tatsunori Hashimoto",
    arxiv_author_id: "Tatsunori Hashimoto",
    notes: "LLMs, evaluation, robustness",
  },
  {
    id: "graham-neubig",
    institution_id: "cmu",
    name: "Graham Neubig",
    arxiv_author_id: "Graham Neubig",
    notes: "NLP, code generation, neural MT",
  },
  {
    id: "ruslan-salakhutdinov",
    institution_id: "cmu",
    name: "Ruslan Salakhutdinov",
    arxiv_author_id: "Ruslan Salakhutdinov",
    notes: "Deep learning, generative models",
  },
  {
    id: "zico-kolter",
    institution_id: "cmu",
    name: "Zico Kolter",
    arxiv_author_id: "Zico Kolter",
    notes: "ML robustness, optimization, deep learning",
  },
  {
    id: "tom-mitchell",
    institution_id: "cmu",
    name: "Tom Mitchell",
    arxiv_author_id: "Tom Mitchell",
    notes: "Machine learning (CMU); name collision risk on arXiv",
  },
  {
    id: "dawn-song",
    institution_id: "berkeley",
    name: "Dawn Song",
    arxiv_author_id: "Dawn Song",
    notes: "Security, deep learning, trustworthy AI",
  },
  {
    id: "pieter-abbeel",
    institution_id: "berkeley",
    name: "Pieter Abbeel",
    arxiv_author_id: "Pieter Abbeel",
    notes: "Robotics, reinforcement learning, imitation learning",
  },
  {
    id: "sergey-levine",
    institution_id: "berkeley",
    name: "Sergey Levine",
    arxiv_author_id: "Sergey Levine",
    notes: "RL, robotics, offline RL",
  },
  {
    id: "koushik-sen",
    institution_id: "berkeley",
    name: "Koushik Sen",
    arxiv_author_id: "Koushik Sen",
    notes: "Software engineering, testing, program analysis + AI",
  },
  {
    id: "kathleen-mckeown",
    institution_id: "columbia",
    name: "Kathleen McKeown",
    arxiv_author_id: "Kathleen McKeown",
    notes: "NLP, summarization, generation",
  },
  {
    id: "junfeng-yang",
    institution_id: "columbia",
    name: "Junfeng Yang",
    arxiv_author_id: "Junfeng Yang",
    notes: "Systems, reliability; systems+ML overlap",
  },
  {
    id: "zhou-yu",
    institution_id: "columbia",
    name: "Zhou Yu",
    arxiv_author_id: "Zhou Yu",
    notes: "Conversational AI, dialogue, NLP",
  },
  {
    id: "salvatore-stolfo",
    institution_id: "columbia",
    name: "Salvatore Stolfo",
    arxiv_author_id: "Salvatore Stolfo",
    notes: "Security, intrusion detection, ML for security",
  },
];

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i]!;
    if (i > 0) await sleep(DELAY_MS);
    const papers = await fetchRecentPapers(row.arxiv_author_id, 20);
    const expected_count = countRecentRelevant(papers);
    const firstTitles = papers.slice(0, 3).map((p) => p.title.slice(0, 70));
    console.error(
      JSON.stringify({
        id: row.id,
        papers: papers.length,
        expected_count,
        sample: firstTitles,
      })
    );
    out.push({
      ...row,
      expected_count,
      verify_needed: false,
    });
  }
  console.log(JSON.stringify({ professors: out }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
