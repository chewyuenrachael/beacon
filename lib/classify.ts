import type { MentionRaw, ClassificationInput, ClassificationOutput, AudienceRelevance, ClassificationWithAudience } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase';

const CLASSIFICATION_SYSTEM_PROMPT = `You are a communications intelligence analyst for a developer tools company (Anthropic, makers of Claude and Claude Code). Your job is to classify mentions from developer community platforms.

For each mention, determine ALL of the following:

1. URGENCY — How quickly does the comms team need to act?
   - "fire": Requires response within hours. Examples: security vulnerability disclosure, major outage report, viral negative thread (100+ points on HN), factual misinformation spreading, journalist inquiry, leaked feature
   - "moment": Worth amplifying or engaging with within 24 hours. Examples: impressive project built with Claude Code, positive viral thread, community milestone, developer testimonial, creative use case
   - "signal": Trend or pattern worth tracking over time. Examples: recurring feature requests, shifting sentiment, emerging competitor narrative, developer workflow pattern
   - "noise": Log but no action needed. Examples: casual mention, generic comparison, already-known information, low-engagement gripe

COMMUNITY BUILDS ARE HIGH-SIGNAL. When a developer builds a tool, integration, extension, or workflow that extends or connects to Claude Code, this is almost always a "moment" — not noise. The comms team wants to know about these because they represent ecosystem growth and potential case studies. Examples:
- Someone built a visual annotation tool for Claude Code → moment
- Someone built a mobile interface for Claude Code → moment
- Someone built a new file format (like operate.txt) for AI agents → moment
- Someone built a monitoring dashboard for Claude Code sessions → moment
- Someone open-sourced a Claude Code skill or plugin → moment
The only community builds that are "noise" are trivial (e.g., "I made a todo app with Claude Code") with no novel integration or workflow innovation.

SECURITY AND SAFETY MENTIONS ARE ALWAYS HIGH-URGENCY. Any mention of:
- Claude Code bypassing restrictions, sandboxes, or permissions → fire
- Claude Code executing unintended actions or ignoring instructions → fire
- Vulnerabilities in Claude Code's permission model → fire
- AI agents behaving unexpectedly or dangerously → fire
These are never noise, even if the poster's tone is casual or curious.

COMPETITOR COMPARISONS ARE ALWAYS SIGNAL OR HIGHER. When a developer directly compares Claude Code to a competitor (Gemini CLI, Cursor, Copilot, Windsurf, Devin, Codex), classify as:
- "signal" if it's a general preference comparison
- "moment" if the developer switched TO Claude Code from a competitor
- "fire" if the developer switched FROM Claude Code to a competitor and the post is gaining traction

2. SUMMARY — One sentence capturing what this mention says and why it matters.

3. RECOMMENDED_ACTION — One concrete sentence: what should the comms team member do? Be specific.

4. HOPE_SCORE — How much hope, optimism, or excitement about AI does this mention express? 0 = none, 1 = mild, 2 = moderate, 3 = strong

5. CONCERN_SCORE — How much concern, worry, or alarm about AI does this mention express? 0 = none, 1 = mild, 2 = moderate, 3 = strong

NOTE on HOPE_SCORE and CONCERN_SCORE: These are INDEPENDENT axes, not opposites. A post can be high on BOTH (hope=3, concern=3) when someone is excited about a capability but worried about its implications. This coexistence of hope and alarm is extremely common in developer discourse about AI tools. Do NOT force them to be inverses.

6. TENSION_TYPE — If both hope_score >= 2 AND concern_score >= 2, classify the specific tension:
   - "learning_vs_atrophy": Excited about AI-accelerated learning but worried about skill decay
   - "time_savings_vs_treadmill": AI saves time but expectations just increase
   - "empowerment_vs_displacement": AI enables building but threatens jobs
   - "decision_support_vs_erosion": AI aids decisions but erodes independent judgment
   - "productivity_vs_dependency": AI boosts output but creates reliance
   - "none": No tension detected (or hope/concern below threshold)

7. PRIMARY_EMOTION — The single dominant emotion. Pick one: "excitement", "frustration", "fear", "admiration", "disappointment", "curiosity", "anger", "relief", "resignation", "awe", "skepticism", "neutral"

8. TOPIC — Classify the mention's primary narrative theme. Pick ONE:
   - "safety-alignment": AI safety concerns, alignment research, responsible development, existential risk, model evaluations, interpretability, red-teaming, constitutional AI, RLHF debates. Example: "Claude's safety training makes it refuse too many requests"
   - "developer-experience": Product UX, bugs, performance, latency, developer workflows, IDE integration, Claude Code usability, API ergonomics, context window, tool calling. Example: "Claude Code's multi-file editing is incredible but tab completion still lags"
   - "enterprise-adoption": Business use cases, ROI, team rollouts, compliance, SOC2, enterprise pricing, IT procurement, scaling within organizations. Example: "We deployed Claude across our 200-person eng team and saved 3000 hours last quarter"
   - "competitive-positioning": Head-to-head comparisons with Cursor, Copilot, Gemini, GPT, Codex, Windsurf, Devin. Switching stories. Benchmark comparisons. Market positioning. Example: "Switched from Cursor to Claude Code — here's what's better and worse"
   - "pricing-access": Cost, token pricing, rate limits, free tier limitations, API pricing changes, value for money, accessibility in different markets. Example: "Claude Pro is $20/month but the rate limits make it unusable for real work"
   - "open-source-ecosystem": MCP protocol, open-source tools built on Claude, community projects, integrations, Claude Code extensions, third-party ecosystem. Example: "Built an MCP server that connects Claude Code to our internal docs"
   - "regulation-policy": Government regulation, EU AI Act, executive orders, congressional hearings, lobbying, policy positions, geopolitical implications. Example: "Anthropic's testimony to Congress on AI safety was the most substantive of any lab"
   - null: Does not clearly fit any theme, or too vague to classify.
   Rules:
   - Pick the SINGLE most dominant theme. Don't default to "developer-experience" just because a developer wrote it — a developer complaining about pricing is "pricing-access", not "developer-experience".
   - If the mention is a competitive comparison, it's "competitive-positioning" even if they're comparing developer experience.
   - If the mention is genuinely off-topic or too vague to classify, return null.

9. IS_COMPETITOR_MENTION — Does this compare Claude Code to a competitor or discuss switching?

10. COMPETITOR_NAMES — Array of competitor product names mentioned (e.g., ["Cursor", "Copilot"])

11. CREDIBILITY_SIGNAL — How influential is this poster likely to be?
    - "high": Known developer, popular project maintainer, tech journalist, high HN karma (500+), popular YouTuber
    - "medium": Active community member, moderate engagement
    - "low": New account, low engagement, unclear identity
    - "unknown": Cannot determine

12. TOPICS — Array of 1-3 tags from: ["performance", "pricing", "agent-teams", "security", "reliability", "developer-experience", "migration", "enterprise", "open-source", "tutorial", "comparison", "bug-report", "feature-request", "use-case", "community"]

13. INFERRED_REGION — Best guess at poster's geographic region based on language, cultural cues, timezone references, currency mentions, or subreddit. Use: "north-america", "europe", "east-asia", "south-asia", "southeast-asia", "latin-america", "middle-east", "africa", "oceania", or null if no signal.

INTENSITY CALIBRATION:

Score 0: No emotional markers. Pure factual reporting. "Claude Code uses a CLI interface."
Score 1: Hedged language — "might," "could," "sort of," "a bit." Low arousal. "I'm a bit concerned about accuracy."
Score 2: Direct statements with standard intensifiers — "really," "definitely," "clearly." Explicit emotion words. Medium arousal. "This has genuinely improved my workflow."
Score 3: Absolutist language — "never," "always," "completely," ALL CAPS, exclamation marks, physical sensation language, profanity, hyperbolic metaphors. "This is the most exciting thing since we connected computers to the internet."

MIXED EMOTIONS: Hope and concern are INDEPENDENT axes. Look for contrastive conjunctions ("but," "however," "on one hand"), concessive structures ("While X is great, Y concerns me"), and temporal framing ("For now it's useful, but long-term..."). These posts should score non-zero on BOTH.

DEVELOPER TEXT IS DIFFERENT: Words like "kill," "crash," "abort," and "fatal" are neutral technical terms, not emotional markers. Developer emotion manifests through performance metrics ("build time went from 30 min to 3 min"), technical critique, and capability comparisons. Senior developers express strong feelings through understatement, not hyperbole.

CREDIBILITY AND EMOTION ARE INVERSELY CORRELATED: The most influential developers (language creators, popular maintainers, staff engineers) use calm, analytical language. A measured observation from a high-credibility poster is MORE important than an emotional rant from an unknown account, not less. Do not conflate low emotional intensity with low importance. If credibility_signal is "high" and the content is substantive, urgency should be at least "signal" even if the tone is neutral.

DISTINGUISHING SIMILAR EMOTIONS:
- frustration vs anger: Frustration is self-directed or directed at the tool ("waste of time," "doesn't work"). Anger is directed at external actors — companies, management, other people ("they're forcing us," "they expect features in a day"). Anger implies blame; frustration implies disappointment.
- skepticism vs fear: Skepticism is intellectual rejection with low personal stakes ("show me the numbers," "cult leaders"). Fear is personal vulnerability with high stakes ("looking for an offramp," "3 years to find an exit"). Skepticism questions whether AI works; fear accepts that it does and dreads the consequences.
- awe vs excitement: Awe is present-tense amazement at what exists now ("never thought this was possible," "reading my mind"). Excitement is future-oriented anticipation of what comes next ("imagine what we could build," "game changer"). Awe looks backward at how far we've come; excitement looks forward.
- disappointment vs resignation: Disappointment is unmet expectations with residual hope ("I thought I was going to learn something"). Resignation is accepted loss without hope ("it's just a matter of time," "this is my cope").

CATEGORICAL RULES (these override sentiment analysis):
- Developer builds a tool/integration/extension for Claude Code → always "moment"
- Security bypass, sandbox escape, permission vulnerability → always "fire"
- Direct competitor comparison (Gemini CLI, Cursor, Copilot, Windsurf, Devin, Codex) → at minimum "signal"
- Developer switched FROM Claude Code to competitor → "fire" if gaining traction
- Developer switched TO Claude Code from competitor → "moment"
- Named high-profile developer (language creator, popular OSS maintainer, tech journalist) posting substantively → at minimum "signal"

CONTEXT:
- Claude Code is Anthropic's agentic coding tool (CLI + web). Competes with Cursor, GitHub Copilot, Windsurf, Devin, and Replit Agent.
- A viral HN thread (100+ points) about a bug is a "fire" even if sentiment is mixed — velocity matters.
- Competitor mentions showing users switching FROM Claude Code are higher urgency than general comparisons.
- When in doubt between two urgency levels, pick the higher one. Missing a fire is worse than over-flagging.

CALIBRATION EXAMPLES:

Example: "I built this tool called Snip. You can screenshot, annotate, and draw to show the agent what you mean. Snip is free! Open source at snipit.dev"
→ urgency: "moment", hope_score: 3, concern_score: 0, tension_type: "none", primary_emotion: "excitement", topic: "open-source-ecosystem", topics: ["use-case", "open-source", "developer-experience"]
WHY: Developer built an open-source tool extending Claude Code's capabilities. This is ecosystem growth the comms team should amplify.

Example: "We told Claude Code to block npx using its own denylist. The agent found another way to run it and copied the binary to bypass the deny pattern. When the sandbox caught that, the agent disabled the sandbox."
→ urgency: "fire", hope_score: 0, concern_score: 3, tension_type: "none", primary_emotion: "fear", topic: "safety-alignment", topics: ["security", "reliability"]
WHY: AI agent bypassing safety controls is a critical security concern regardless of poster tone.

Example: "For claude code, the streaming output on the terminal is hard to follow; while gemini will print out whatever the AI sees. I kind of feel that gemini cli usually finish a task faster than claude code."
→ urgency: "signal", hope_score: 0, concern_score: 1, tension_type: "none", primary_emotion: "disappointment", topic: "competitive-positioning", is_competitor_mention: true, competitor_names: ["Gemini CLI"], topics: ["comparison", "developer-experience"]
WHY: Direct competitor comparison with specific UX criticism. The comms team needs to track these patterns.

Example: "I built Vibe Remote because I wanted to keep my Claude Code sessions going from my phone, anywhere I go. No Tailscale or complex VPN setup required."
→ urgency: "moment", hope_score: 2, concern_score: 0, tension_type: "none", primary_emotion: "excitement", topic: "developer-experience", topics: ["use-case", "developer-experience"]
WHY: Novel mobile access tool for Claude Code. Community innovation worth amplifying.

Example: "I had Claude navigate my product with computer use. It kept struggling at loading states. So I built operate.txt — a YAML file that tells AI agents how to operate a product. Open-sourced the spec."
→ urgency: "moment", hope_score: 2, concern_score: 1, tension_type: "none", primary_emotion: "curiosity", topic: "open-source-ecosystem", topics: ["use-case", "open-source", "developer-experience"]
WHY: Developer identified a gap in AI agent UX and built an open standard to fix it. High-signal community innovation.

Example: "Claude Code has catapulted my performance at least 5x. I just create a plan, iterate, then let it implement. No manual writing of code at all."
→ urgency: "moment", hope_score: 3, concern_score: 0, tension_type: "none", primary_emotion: "awe", topic: "developer-experience", topics: ["use-case", "developer-experience"]

Example: "After 12 years of programming, AI's instant help made me worse at my own craft. I stopped reading documentation. Debugging skills waned. I've become a human clipboard."
→ urgency: "signal", hope_score: 0, concern_score: 3, tension_type: "learning_vs_atrophy", primary_emotion: "fear", topic: "safety-alignment", topics: ["developer-experience", "reliability"]

Example: "The optimistic scenario is that AI makes software so cheap that we build things we never would have attempted. The pessimistic one is that most of what needed building gets built, and the remaining work fits in fewer hands."
→ urgency: "signal", hope_score: 2, concern_score: 2, tension_type: "empowerment_vs_displacement", primary_emotion: "curiosity", topic: "enterprise-adoption", topics: ["community"]

14. AUDIENCE_RELEVANCE — Score which internal teams should see this mention. For each audience, score 0-2:
- 0 = not relevant to this team
- 1 = somewhat relevant, include in their digest
- 2 = highly relevant, prioritize in their digest

Audiences:
- "product": Feature requests, UX complaints, switching signals ("I switched from Claude to Cursor because..."), competitive feature comparisons, developer workflow pain points, API usability feedback
- "engineering": Reliability issues, performance complaints, bug reports, specific error messages, latency concerns, API downtime, benchmark comparisons, infrastructure discussions
- "safety": Jailbreak reports, model behavior issues (hallucinations, harmful outputs, refusal problems), alignment discourse, misuse incidents, safety research discussion, responsible AI debates
- "policy": Regulatory mentions, government actions, legislation, AI governance, international policy, compliance discussions, legal implications
- "executive": Score 2 ONLY for major strategic events: significant competitor launch, major media story, regulatory action, viral incident. Most mentions should be 0 for executive.

Return as: "audience_relevance": [
  { "slug": "product", "relevance": 0|1|2, "reason": "one line why" },
  { "slug": "engineering", "relevance": 0|1|2, "reason": "one line why" },
  { "slug": "safety", "relevance": 0|1|2, "reason": "one line why" },
  { "slug": "policy", "relevance": 0|1|2, "reason": "one line why" },
  { "slug": "executive", "relevance": 0|1|2, "reason": "one line why" }
]

Respond with ONLY valid JSON, no markdown, no backticks, no preamble. Start directly with the opening brace {.`;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function preprocessBody(raw: string): string {
  let text = raw;
  // Decode HTML entities
  text = text.replace(/&#x2F;/g, '/');
  text = text.replace(/&#x27;/g, "'");
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#\d+;/g, ''); // remove remaining numeric entities
  text = text.replace(/&#x[0-9a-fA-F]+;/g, ''); // remove hex entities
  // Strip HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  // Clean up markdown artifacts
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url) -> text
  text = text.replace(/\*\*/g, ''); // remove bold markers
  text = text.replace(/\\/g, ''); // remove escape backslashes
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export async function classifyMention(input: ClassificationInput): Promise<ClassificationWithAudience> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify this mention:\n\nSource: ${input.source}\nTitle: ${input.title}\nBody: ${preprocessBody(input.body).slice(0, 2000)}${input.body.length > 2000 ? ' [truncated]' : ''}\nAuthor: ${input.author}\nEngagement: ${input.engagement_score}\nPublished: ${input.published_at}`,
        },
        {
          role: 'assistant',
          content: '{',
        },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('Claude API error:', data.error);
    throw new Error(`Claude API: ${data.error.message || JSON.stringify(data.error)}`);
  }

  if (!data.content || !data.content[0]) {
    console.error('Empty Claude response:', JSON.stringify(data));
    throw new Error('Empty response from Claude');
  }

  // Prepend the { we used as prefill
  const rawText = '{' + data.content[0].text;
  console.log('PARSING:', rawText.substring(0, 100));

  // Clean: strip code fences if present
  let cleaned = rawText;
  cleaned = cleaned.replace(/^```json\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    return withAudienceRelevance(parsed);
  } catch (e) {
    // Fallback: extract first complete JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return withAudienceRelevance(parsed);
      } catch (e2) {
        console.error('JSON extraction failed:', match[0].substring(0, 200));
        throw e2;
      }
    }
    console.error('No JSON found in:', cleaned.substring(0, 300));
    throw e;
  }
}

function withAudienceRelevance(parsed: Record<string, unknown>): ClassificationWithAudience {
  const ar = parsed.audience_relevance;
  return {
    ...(parsed as unknown as ClassificationOutput),
    audience_relevance: Array.isArray(ar) ? ar : [],
  };
}

export async function classifyBatch(mentions: ClassificationInput[]): Promise<ClassificationWithAudience[]> {
  const results: ClassificationWithAudience[] = [];

  for (const mention of mentions) {
    try {
      const result = await classifyMention(mention);
      results.push(result);
      await delay(6000);
    } catch (error) {
      console.error(`Classification failed for ${mention.source}/${mention.title}:`, error);
      results.push(getDefaultClassification());
    }
  }

  return results;
}

export function getDefaultClassification(): ClassificationWithAudience {
  return {
    urgency: 'noise',
    urgency_reason: 'Classification failed — defaulting to noise',
    summary: 'Unable to classify',
    recommended_action: 'Review manually',
    hope_score: 0,
    concern_score: 0,
    tension_type: 'none',
    primary_emotion: 'neutral',
    topic: null,
    is_competitor_mention: false,
    competitor_names: [],
    credibility_signal: 'unknown',
    topics: [],
    inferred_region: null,
    audience_relevance: [],
  };
}

export async function insertNewMentions(mentions: MentionRaw[]): Promise<MentionRaw[]> {
  if (mentions.length === 0) return [];

  // INSERT ... ON CONFLICT (source, source_id) DO NOTHING
  const { error } = await supabaseAdmin
    .from('mentions')
    .upsert(
      mentions.map(m => ({
        source: m.source,
        source_id: m.source_id,
        source_url: m.source_url,
        title: m.title,
        body: m.body,
        author: m.author,
        author_karma: m.author_karma,
        engagement_score: m.engagement_score,
        published_at: m.published_at,
        fetched_at: m.fetched_at,
        raw_json: m.raw_json,
      })),
      { onConflict: 'source,source_id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('Failed to insert mentions:', error);
    return [];
  }

  // Retrieve newly inserted rows (those without classification yet)
  const sourceIds = mentions.map(m => m.source_id);
  const { data: newRows } = await supabaseAdmin
    .from('mentions')
    .select('source_id')
    .in('source_id', sourceIds)
    .is('classified_at', null);

  if (!newRows) return [];

  const newSourceIds = new Set(newRows.map((r: { source_id: string }) => r.source_id));
  return mentions.filter(m => newSourceIds.has(m.source_id));
}

export async function updateMentionsWithClassifications(
  mentions: MentionRaw[],
  classifications: ClassificationOutput[]
): Promise<void> {
  for (let i = 0; i < mentions.length; i++) {
    const mention = mentions[i];
    const classification = classifications[i];
    if (!classification) continue;

    const { error } = await supabaseAdmin
      .from('mentions')
      .update({
        urgency: classification.urgency,
        urgency_reason: classification.urgency_reason,
        summary: classification.summary,
        recommended_action: classification.recommended_action,
        hope_score: classification.hope_score,
        concern_score: classification.concern_score,
        tension_type: classification.tension_type ?? null,
        primary_emotion: classification.primary_emotion ?? null,
        topic: classification.topic ?? null,
        is_competitor_mention: classification.is_competitor_mention ?? false,
        competitor_names: classification.competitor_names ?? [],
        credibility_signal: classification.credibility_signal ?? null,
        topics: classification.topics ?? [],
        inferred_region: classification.inferred_region ?? null,
        classified_at: new Date().toISOString(),
        classification_raw: classification,
      })
      .eq('source', mention.source)
      .eq('source_id', mention.source_id);

    if (error) {
      console.error(`Failed to update classification for ${mention.source}/${mention.source_id}:`, error);
    }
  }
}
