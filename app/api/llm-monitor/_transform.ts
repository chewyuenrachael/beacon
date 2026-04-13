/**
 * Transform raw Supabase LLM response rows into the shape expected by
 * the dashboard (app/dashboard/llm-monitor/types.ts).
 */

const SEVERITY_MAP: Record<string, string> = {
  critical: "critical",
  high: "major",
  low: "minor",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformResponse(raw: any) {
  const probe = raw.probe ?? raw.llm_probes ?? null;
  const cls = raw.classification ?? raw.llm_response_classifications ?? null;

  // Severity: classifier uses critical/high/low, dashboard expects critical/major/minor
  const errors = Array.isArray(cls?.factual_errors)
    ? cls.factual_errors.map((e: { claim: string; reality: string; severity: string }) => ({
        claim: e.claim,
        reality: e.reality,
        severity: SEVERITY_MAP[e.severity] || "minor",
      }))
    : [];

  // Narratives: classifier returns [{slug, present, framing}], dashboard expects Record<slug, {present, framing}>
  const narrativesArray = Array.isArray(cls?.narratives_reflected)
    ? (cls.narratives_reflected as { slug: string; present: boolean; framing: string }[])
    : [];
  const narratives: Record<string, { present: boolean; framing: string }> = {};
  for (const n of narrativesArray) {
    narratives[n.slug] = { present: n.present, framing: n.framing };
  }

  // Competitors: classifier returns [{name, sentiment, positioned_as}], dashboard expects string[]
  const competitorsMentioned = Array.isArray(cls?.competitors_mentioned)
    ? cls.competitors_mentioned.map((c: { name: string }) => c.name)
    : [];

  // Favored: classifier returns string[], dashboard expects string|null
  const favored = Array.isArray(cls?.competitors_favored) ? cls.competitors_favored : [];
  const competitorFavored = favored.length > 0 ? favored[0] : null;

  return {
    id: raw.id,
    platform: raw.platform,
    model: raw.model_version || "",
    probe_id: raw.probe_id,
    probe_prompt: probe?.prompt_text || "",
    probe_category: probe?.category || "",
    response_text: raw.response_text,
    response_date: raw.response_date,
    classification: cls
      ? {
          brand_mentioned: Boolean(cls.anthropic_mentioned),
          sentiment: Number(cls.mention_sentiment) || 0,
          rank: cls.anthropic_rank != null ? Number(cls.anthropic_rank) : null,
          competitors_mentioned: competitorsMentioned,
          competitor_favored: competitorFavored,
          narratives,
          errors,
          analysis_summary: cls.analysis_summary || "",
          highlights: [],
        }
      : {
          brand_mentioned: false,
          sentiment: 0,
          rank: null,
          competitors_mentioned: [],
          competitor_favored: null,
          narratives: {},
          errors: [],
          analysis_summary: "",
          highlights: [],
        },
  };
}
