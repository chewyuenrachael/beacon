# PULSE — Developer Comms Intelligence Platform

## Product spec v1.1

**Owner:** Rachael Chew
**Stack:** Next.js 14 (App Router), Supabase (Postgres + Auth), Claude API (Sonnet 4.6), Vercel, Tailwind CSS
**Repo:** `beacon/` (monorepo, single Next.js app)
**Deploy target:** Vercel (vercel.com)
**Supabase project:** Create new project named `beacon`

---

## 1. What this is

Beacon is a developer comms intelligence tool that monitors the platforms where developer sentiment actually forms (Hacker News, Reddit, YouTube, newsletters, and later X), classifies every mention using Claude into actionable urgency tiers, and delivers a triage-ready morning brief to a comms team via a web dashboard and Slack-formatted digest.

**This is not a social listening tool.** Social listening tools (Brandwatch, Meltwater, Sprinklr) collect mentions. Beacon answers the comms team's actual morning question: "Do I need to do something about this, and how urgently?"

**What makes Beacon different from existing tools:**

1. **Platform coverage.** Enterprise tools miss Hacker News entirely — the single most important platform for developer AI-tool sentiment. Beacon monitors HN, Reddit, YouTube, and dev newsletters natively.

2. **Comms-grade triage.** Existing tools classify mentions as positive/negative. Beacon classifies by urgency (fire/moment/signal/noise) with a specific recommended action for each mention. This maps directly to how a comms team actually works.

3. **Tension detection.** Inspired by Anthropic's 81K-person interview study finding that hope and alarm coexist within each individual, Beacon classifies mentions along a hope × concern axis rather than collapsing to a single sentiment score. A developer writing "Claude Code is incredible but I'm terrified of what this means for junior devs" isn't ambivalent — they're experiencing a tension. Beacon captures that.

4. **Engagement velocity.** Rather than just measuring current engagement, Beacon tracks the rate of engagement accumulation in the first 60 minutes against platform baselines. A post gaining points 3× faster than normal gets flagged as "accelerating" before it hits the front page.

### Prior art from Quantstamp

This tool is informed by real operational experience. At Quantstamp, the builder:
- Reviewed 165 Build-to-Earn submissions in a single push using a triage rubric (mute, reject, pass, prioritize)
- Built structured tracking databases with fields for priority, status, follow-up dates, and escalation paths
- Created standardized templates for outreach, due diligence, and call notes
- Operated a high-volume intake → triage → route → escalate pipeline across multiple rounds

Beacon applies this same triage-and-route operational pattern to comms signal monitoring: intake (scrape) → classify (Claude) → route (urgency tier) → surface (dashboard + Slack brief).

### Cognitive science foundation

The classification system draws on three frameworks:
- **Appraisal theory (Scherer):** Emotions arise from cognitive evaluations — novelty, goal-relevance, coping potential, normative significance. Every developer post about an AI tool implicitly encodes these appraisals. The classification prompt asks Claude to extract them.
- **Tension detection (Anthropic 81K study):** Five recurring tensions — learning ↔ cognitive atrophy, time savings ↔ treadmill effect, economic empowerment ↔ job displacement, emotional support ↔ dependency, decision support ↔ judgment erosion. Someone excited about a benefit is 3× more likely to also fear the associated harm.
- **Engagement cascade dynamics (Goel, Anderson, Hofman, Watts):** 99% of online cascades terminate within one generation. The rare ones that don't are predicted by breadth of early engagement, not depth. Velocity in the first hour matters more than absolute score.

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: INGESTION (Vercel Cron, every 30 min)     │
│                                                       │
│  HN Algolia API → Reddit .json → YouTube Data       │
│  API v3 → RSS feeds (newsletters)                    │
│                                                       │
│  Each source adapter normalizes to MentionRaw        │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2: CLASSIFICATION (Claude Sonnet 4.6)        │
│                                                       │
│  Each MentionRaw → Claude API → MentionClassified   │
│                                                       │
│  Output: urgency, summary, action, hope/concern     │
│  scores, tension_type, competitor, credibility,      │
│  inferred_region                                     │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2.5: VELOCITY ENGINE (computed post-insert)  │
│                                                       │
│  Compare engagement_score delta against per-source  │
│  baseline → flag "accelerating" mentions             │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 3: STORAGE (Supabase Postgres)               │
│                                                       │
│  mentions + engagement_snapshots + daily_briefs     │
│  Deduplication by source + source_id                │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 4: OUTPUTS                                    │
│                                                       │
│  Dashboard │ Morning Brief │ Alerts │ World Map     │
│  Feed+filt │ Slack-ready   │ Fire→  │ Regional      │
│  +tension  │ +tensions     │ ping   │ sentiment     │
└─────────────────────────────────────────────────────┘
```

---

## 3. Data sources — detailed specs

### 3a. Hacker News (Algolia API)

**Endpoint:** `https://hn.algolia.com/api/v1/search_by_date`
**Auth:** None required
**Rate limit:** 10,000 requests/hour
**Polling interval:** Every 30 minutes

```
GET https://hn.algolia.com/api/v1/search_by_date?query="claude code"&tags=(story,comment)&numericFilters=created_at_i>{last_poll_unix}
```

**Keywords to monitor (configurable via dashboard):**
- Primary: `"claude code"`, `"claude agent"`, `"anthropic"`, `"claude sonnet"`, `"claude opus"`
- Competitor: `"cursor ai"`, `"github copilot"`, `"windsurf"`, `"devin ai"`, `"replit agent"`, `"augment code"`
- Context: `"agentic coding"`, `"ai coding assistant"`, `"vibe coding"`

**Fields to extract:**
```typescript
interface HNItem {
  objectID: string;
  title: string | null;
  url: string | null;
  story_text: string | null;
  comment_text: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at: string;
  story_url: string;
  parent_id: number | null;
  story_id: number | null;
}
```

**Normalization to MentionRaw:**
```typescript
{
  source: "hackernews",
  source_id: objectID,
  source_url: `https://news.ycombinator.com/item?id=${objectID}`,
  title: title || `Comment on: ${story_title}`,
  body: comment_text || story_text || "",
  author: author,
  author_karma: null,
  engagement_score: (points || 0) + (num_comments || 0),
  published_at: created_at,
  fetched_at: new Date().toISOString(),
  raw_json: JSON.stringify(item)
}
```

### 3b. Reddit (.json endpoints)

**Method:** Append `.json` to subreddit URLs
**Auth:** None for public subreddits (rate limited to ~60 req/min without OAuth)
**User-Agent:** Required. Set to `Beacon/1.0 (comms-intelligence-tool)`

**Subreddits to monitor:**
- `r/ClaudeAI` (primary)
- `r/anthropic`
- `r/ChatGPTCoding` (competitor context)
- `r/LocalLLaMA` (developer sentiment)
- `r/programming` (general dev)
- `r/ExperiencedDevs`

**Endpoint pattern:**
```
GET https://www.reddit.com/r/ClaudeAI/new.json?limit=25&t=hour
```

**Fields to extract from `data.children[].data`:**
```typescript
{
  source: "reddit",
  source_id: data.id,
  source_url: `https://reddit.com${data.permalink}`,
  title: data.title || "",
  body: data.selftext || data.body || "",
  author: data.author,
  author_karma: null,
  engagement_score: data.score + data.num_comments,
  published_at: new Date(data.created_utc * 1000).toISOString(),
  fetched_at: new Date().toISOString(),
  raw_json: JSON.stringify(data)
}
```

**Important:** Filter by keywords client-side after fetching. Reddit's .json endpoints don't support search within subreddits well. Fetch recent posts, then filter for relevance in the classification step.

### 3c. YouTube (Data API v3)

**Endpoint:** `https://www.googleapis.com/youtube/v3/search`
**Auth:** API key (free tier: 10,000 units/day; search costs 100 units each = 100 searches/day)
**Polling interval:** Every 6 hours (conserve quota)

```
GET https://www.googleapis.com/youtube/v3/search?part=snippet&q="claude code"&type=video&order=date&publishedAfter={last_poll_iso}&maxResults=10&key={API_KEY}
```

**Fields to extract:**
```typescript
{
  source: "youtube",
  source_id: item.id.videoId,
  source_url: `https://youtube.com/watch?v=${item.id.videoId}`,
  title: item.snippet.title,
  body: item.snippet.description,
  author: item.snippet.channelTitle,
  author_karma: null,
  engagement_score: 0,
  published_at: item.snippet.publishedAt,
  fetched_at: new Date().toISOString(),
  raw_json: JSON.stringify(item)
}
```

### 3d. RSS feeds (newsletters + blogs)

**Library:** Use `rss-parser` npm package
**Polling interval:** Every 2 hours

**Feeds to monitor:**
```typescript
const RSS_FEEDS = [
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
  { name: "The Pragmatic Engineer", url: "https://feeds.feedburner.com/ThePragmaticEngineer" },
  { name: "TLDR", url: "https://tldr.tech/api/rss/tech" },
  { name: "Changelog", url: "https://changelog.com/feed" },
  { name: "Hacker Newsletter", url: "https://feeds.feedburner.com/hackernewsletter" },
  { name: "Anthropic Blog", url: "https://www.anthropic.com/rss.xml" },
  { name: "Latent Space", url: "https://www.latent.space/feed" },
];
```

**Normalization:** Standard RSS fields → MentionRaw. Filter for keyword relevance in body/title.

---

## 4. Database schema (Supabase Postgres)

### Table: `mentions`

```sql
CREATE TABLE mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('hackernews', 'reddit', 'youtube', 'rss', 'manual')),
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,

  -- Content
  title TEXT,
  body TEXT,
  author TEXT,
  author_karma INTEGER,
  engagement_score INTEGER DEFAULT 0,

  -- Timestamps
  published_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  classified_at TIMESTAMPTZ,

  -- Classification: urgency + action (populated by Claude)
  urgency TEXT CHECK (urgency IN ('fire', 'moment', 'signal', 'noise')),
  urgency_reason TEXT,
  summary TEXT,
  recommended_action TEXT,

  -- Classification: emotion (replaces simple positive/negative)
  hope_score SMALLINT DEFAULT 0 CHECK (hope_score BETWEEN 0 AND 3),
  concern_score SMALLINT DEFAULT 0 CHECK (concern_score BETWEEN 0 AND 3),
  tension_type TEXT CHECK (tension_type IN (
    'learning_vs_atrophy',
    'time_savings_vs_treadmill',
    'empowerment_vs_displacement',
    'decision_support_vs_erosion',
    'productivity_vs_dependency',
    'none'
  )),
  primary_emotion TEXT,

  -- Classification: meta
  is_competitor_mention BOOLEAN DEFAULT FALSE,
  competitor_names TEXT[],
  credibility_signal TEXT CHECK (credibility_signal IN ('high', 'medium', 'low', 'unknown')),
  topics TEXT[],
  inferred_region TEXT,

  -- Velocity tracking
  velocity_status TEXT CHECK (velocity_status IN ('accelerating', 'normal', 'decelerating', 'stale')) DEFAULT 'normal',
  velocity_score REAL DEFAULT 0,

  -- Tracking
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,

  -- Raw data
  raw_json JSONB,
  classification_raw JSONB,

  -- Deduplication
  UNIQUE(source, source_id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mentions_urgency ON mentions(urgency);
CREATE INDEX idx_mentions_source ON mentions(source);
CREATE INDEX idx_mentions_published ON mentions(published_at DESC);
CREATE INDEX idx_mentions_hope_concern ON mentions(hope_score, concern_score);
CREATE INDEX idx_mentions_tension ON mentions(tension_type) WHERE tension_type != 'none';
CREATE INDEX idx_mentions_velocity ON mentions(velocity_status) WHERE velocity_status = 'accelerating';
CREATE INDEX idx_mentions_competitor ON mentions(is_competitor_mention) WHERE is_competitor_mention = TRUE;
CREATE INDEX idx_mentions_unreviewed ON mentions(is_reviewed) WHERE is_reviewed = FALSE;
CREATE INDEX idx_mentions_region ON mentions(inferred_region) WHERE inferred_region IS NOT NULL;
```

### Table: `engagement_snapshots`

Stores periodic engagement readings to calculate velocity. Each cron run records the current engagement_score for mentions less than 6 hours old.

```sql
CREATE TABLE engagement_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  engagement_score INTEGER NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_mention ON engagement_snapshots(mention_id);
CREATE INDEX idx_snapshots_time ON engagement_snapshots(snapshot_at DESC);
```

### Table: `daily_briefs`

```sql
CREATE TABLE daily_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_date DATE NOT NULL UNIQUE,

  fires_section TEXT,
  moments_section TEXT,
  signals_section TEXT,
  competitor_section TEXT,
  tension_section TEXT,
  stats_section TEXT,

  full_brief TEXT NOT NULL,

  mention_count INTEGER,
  fire_count INTEGER,
  moment_count INTEGER,
  tension_count INTEGER,

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `keywords`

```sql
CREATE TABLE keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('primary', 'competitor', 'context')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO keywords (keyword, category) VALUES
  ('claude code', 'primary'),
  ('claude agent', 'primary'),
  ('anthropic', 'primary'),
  ('claude sonnet', 'primary'),
  ('claude opus', 'primary'),
  ('cursor ai', 'competitor'),
  ('github copilot', 'competitor'),
  ('windsurf', 'competitor'),
  ('devin ai', 'competitor'),
  ('replit agent', 'competitor'),
  ('augment code', 'competitor'),
  ('agentic coding', 'context'),
  ('ai coding assistant', 'context');
```

### Table: `ingestion_logs`

```sql
CREATE TABLE ingestion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  mentions_found INTEGER DEFAULT 0,
  mentions_new INTEGER DEFAULT 0,
  mentions_classified INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER
);
```

### Row Level Security

```sql
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_mentions" ON mentions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_mentions" ON mentions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_insert_mentions" ON mentions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_update_mentions" ON mentions FOR UPDATE TO service_role USING (true);
CREATE POLICY "service_manage_snapshots" ON engagement_snapshots FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read_snapshots" ON engagement_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_briefs" ON daily_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_insert_briefs" ON daily_briefs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_upsert_briefs" ON daily_briefs FOR UPDATE TO service_role USING (true);
CREATE POLICY "auth_manage_keywords" ON keywords FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read_logs" ON ingestion_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_logs" ON ingestion_logs FOR ALL TO service_role USING (true);
```

---

## 5. Claude classification pipeline

### System prompt

```typescript
const CLASSIFICATION_SYSTEM_PROMPT = `You are a communications intelligence analyst for a developer tools company (Anthropic, makers of Claude and Claude Code). Your job is to classify mentions from developer community platforms.

For each mention, determine ALL of the following:

1. URGENCY — How quickly does the comms team need to act?
   - "fire": Requires response within hours. Examples: security vulnerability disclosure, major outage report, viral negative thread (100+ points on HN), factual misinformation spreading, journalist inquiry, leaked feature
   - "moment": Worth amplifying or engaging with within 24 hours. Examples: impressive project built with Claude Code, positive viral thread, community milestone, developer testimonial, creative use case
   - "signal": Trend or pattern worth tracking over time. Examples: recurring feature requests, shifting sentiment, emerging competitor narrative, developer workflow pattern
   - "noise": Log but no action needed. Examples: casual mention, generic comparison, already-known information, low-engagement gripe

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

8. IS_COMPETITOR_MENTION — Does this compare Claude Code to a competitor or discuss switching?

9. COMPETITOR_NAMES — Array of competitor product names mentioned (e.g., ["Cursor", "Copilot"])

10. CREDIBILITY_SIGNAL — How influential is this poster likely to be?
    - "high": Known developer, popular project maintainer, tech journalist, high HN karma (500+), popular YouTuber
    - "medium": Active community member, moderate engagement
    - "low": New account, low engagement, unclear identity
    - "unknown": Cannot determine

11. TOPICS — Array of 1-3 tags from: ["performance", "pricing", "agent-teams", "security", "reliability", "developer-experience", "migration", "enterprise", "open-source", "tutorial", "comparison", "bug-report", "feature-request", "use-case", "community"]

12. INFERRED_REGION — Best guess at poster's geographic region based on language, cultural cues, timezone references, currency mentions, or subreddit. Use: "north-america", "europe", "east-asia", "south-asia", "southeast-asia", "latin-america", "middle-east", "africa", "oceania", or null if no signal.

CONTEXT:
- Claude Code is Anthropic's agentic coding tool (CLI + web). Competes with Cursor, GitHub Copilot, Windsurf, Devin, and Replit Agent.
- A viral HN thread (100+ points) about a bug is a "fire" even if sentiment is mixed — velocity matters.
- Competitor mentions showing users switching FROM Claude Code are higher urgency than general comparisons.
- When in doubt between two urgency levels, pick the higher one. Missing a fire is worse than over-flagging.

Respond with ONLY valid JSON, no markdown, no backticks, no preamble.`;
```

### TypeScript types

```typescript
interface MentionRaw {
  source: string;
  source_id: string;
  source_url: string;
  title: string;
  body: string;
  author: string;
  author_karma: number | null;
  engagement_score: number;
  published_at: string;
  fetched_at: string;
  raw_json: string;
}

interface ClassificationInput {
  source: string;
  title: string;
  body: string;
  author: string;
  engagement_score: number;
  published_at: string;
}

interface ClassificationOutput {
  urgency: "fire" | "moment" | "signal" | "noise";
  urgency_reason: string;
  summary: string;
  recommended_action: string;
  hope_score: 0 | 1 | 2 | 3;
  concern_score: 0 | 1 | 2 | 3;
  tension_type: "learning_vs_atrophy" | "time_savings_vs_treadmill" | "empowerment_vs_displacement" | "decision_support_vs_erosion" | "productivity_vs_dependency" | "none";
  primary_emotion: string;
  is_competitor_mention: boolean;
  competitor_names: string[];
  credibility_signal: "high" | "medium" | "low" | "unknown";
  topics: string[];
  inferred_region: string | null;
}

interface VelocityResult {
  velocity_score: number;
  velocity_status: "accelerating" | "normal" | "decelerating" | "stale";
}
```

### Classification function

```typescript
async function classifyMention(input: ClassificationInput): Promise<ClassificationOutput> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Classify this mention:\n\nSource: ${input.source}\nTitle: ${input.title}\nBody: ${input.body.slice(0, 2000)}${input.body.length > 2000 ? " [truncated]" : ""}\nAuthor: ${input.author}\nEngagement: ${input.engagement_score}\nPublished: ${input.published_at}`
      }],
    }),
  });

  const data = await response.json();
  const text = data.content[0].text;
  return JSON.parse(text) as ClassificationOutput;
}
```

### Batch classification

```typescript
async function classifyBatch(mentions: ClassificationInput[]): Promise<ClassificationOutput[]> {
  // ~600 tokens input + 250 tokens output per mention
  // 100 mentions/day ≈ $0.56/day ≈ $17/month
  const results: ClassificationOutput[] = [];
  for (const mention of mentions) {
    try {
      const result = await classifyMention(mention);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Classification failed for ${mention.source}/${mention.title}:`, error);
      results.push(getDefaultClassification());
    }
  }
  return results;
}

function getDefaultClassification(): ClassificationOutput {
  return {
    urgency: "noise",
    urgency_reason: "Classification failed — defaulting to noise",
    summary: "Unable to classify",
    recommended_action: "Review manually",
    hope_score: 0,
    concern_score: 0,
    tension_type: "none",
    primary_emotion: "neutral",
    is_competitor_mention: false,
    competitor_names: [],
    credibility_signal: "unknown",
    topics: [],
    inferred_region: null,
  };
}
```

---

## 6. Engagement velocity engine

### How it works

Every cron run (every 30 minutes), for each mention less than 6 hours old:

1. Re-fetch the mention's current engagement_score from the source API
2. Insert a row into `engagement_snapshots`
3. Calculate velocity: `(current_score - score_30min_ago) / 0.5 hours`
4. Compare against baseline for that source
5. Update `velocity_status` and `velocity_score` on the mention
6. If accelerating and not already a fire, auto-promote to fire urgency and trigger alert

### Velocity calculation (`lib/velocity.ts`)

```typescript
// Baselines (seed defaults, refine with real data)
const VELOCITY_BASELINES: Record<string, number> = {
  hackernews: 15,   // avg points/hour for a mention that reaches 50+ points
  reddit: 8,        // avg score/hour for a post that reaches 100+ upvotes
  youtube: 50,      // avg views/hour for a video that reaches 10K+
  rss: 0,           // RSS has no engagement score; skip velocity
};

const ACCELERATION_MULTIPLIER = 3; // 3x baseline = "accelerating"

async function calculateVelocity(mentionId: string, source: string): Promise<VelocityResult> {
  const { data: snapshots } = await supabase
    .from("engagement_snapshots")
    .select("engagement_score, snapshot_at")
    .eq("mention_id", mentionId)
    .order("snapshot_at", { ascending: false })
    .limit(2);

  if (!snapshots || snapshots.length < 2) {
    return { velocity_score: 0, velocity_status: "normal" };
  }

  const [latest, previous] = snapshots;
  const timeDiffHours =
    (new Date(latest.snapshot_at).getTime() - new Date(previous.snapshot_at).getTime())
    / (1000 * 60 * 60);

  if (timeDiffHours === 0) return { velocity_score: 0, velocity_status: "normal" };

  const velocity_score = (latest.engagement_score - previous.engagement_score) / timeDiffHours;
  const baseline = VELOCITY_BASELINES[source] || 10;

  let velocity_status: VelocityResult["velocity_status"];
  if (velocity_score >= baseline * ACCELERATION_MULTIPLIER) {
    velocity_status = "accelerating";
  } else if (velocity_score <= 0) {
    velocity_status = "decelerating";
  } else if (velocity_score < baseline * 0.1) {
    velocity_status = "stale";
  } else {
    velocity_status = "normal";
  }

  return { velocity_score, velocity_status };
}
```

### Re-fetching engagement for velocity tracking

```typescript
async function updateEngagementSnapshots(): Promise<void> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: recentMentions } = await supabase
    .from("mentions")
    .select("id, source, source_id, engagement_score")
    .gte("published_at", sixHoursAgo)
    .in("source", ["hackernews", "reddit"]);

  if (!recentMentions) return;

  for (const mention of recentMentions) {
    let currentScore: number;

    if (mention.source === "hackernews") {
      const res = await fetch(`https://hn.algolia.com/api/v1/items/${mention.source_id}`);
      const item = await res.json();
      currentScore = (item.points || 0) + (item.children?.length || 0);
    } else if (mention.source === "reddit") {
      const res = await fetch(
        `https://www.reddit.com/comments/${mention.source_id}.json`,
        { headers: { "User-Agent": "Beacon/1.0" } }
      );
      const data = await res.json();
      const post = data?.[0]?.data?.children?.[0]?.data;
      currentScore = post ? post.score + post.num_comments : mention.engagement_score;
    } else {
      continue;
    }

    // Insert snapshot
    await supabase.from("engagement_snapshots").insert({
      mention_id: mention.id,
      engagement_score: currentScore,
    });

    // Update mention current score
    await supabase.from("mentions")
      .update({ engagement_score: currentScore })
      .eq("id", mention.id);

    // Calculate and update velocity
    const velocity = await calculateVelocity(mention.id, mention.source);
    await supabase.from("mentions")
      .update({ velocity_status: velocity.velocity_status, velocity_score: velocity.velocity_score })
      .eq("id", mention.id);

    // Auto-promote to fire if accelerating
    if (velocity.velocity_status === "accelerating") {
      const { data: m } = await supabase
        .from("mentions")
        .select("urgency")
        .eq("id", mention.id)
        .single();

      if (m && m.urgency !== "fire") {
        await supabase.from("mentions")
          .update({
            urgency: "fire",
            urgency_reason: `Engagement accelerating at ${velocity.velocity_score.toFixed(1)} pts/hr (${ACCELERATION_MULTIPLIER}x baseline)`
          })
          .eq("id", mention.id);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
```

---

## 7. API routes

### Directory structure

```
app/
├── api/
│   ├── ingest/
│   │   ├── route.ts              # POST: Trigger full ingestion
│   │   ├── hackernews/route.ts
│   │   ├── reddit/route.ts
│   │   ├── youtube/route.ts
│   │   └── rss/route.ts
│   ├── classify/
│   │   └── route.ts              # POST: Classify unclassified mentions
│   ├── velocity/
│   │   └── route.ts              # POST: Update engagement snapshots
│   ├── brief/
│   │   ├── route.ts              # POST: Generate today's brief
│   │   └── [date]/route.ts       # GET: Retrieve brief for date
│   ├── mentions/
│   │   ├── route.ts              # GET: List with filters
│   │   └── [id]/route.ts         # PATCH: Review, notes
│   ├── keywords/
│   │   └── route.ts              # GET/POST/DELETE
│   ├── stats/
│   │   ├── tensions/route.ts     # GET: Tension distribution
│   │   └── regions/route.ts      # GET: Regional breakdown
│   └── cron/
│       └── route.ts              # POST: Vercel Cron handler
├── dashboard/
│   ├── page.tsx                   # Main feed
│   ├── brief/page.tsx             # Morning brief
│   ├── competitors/page.tsx       # Competitor radar
│   ├── tensions/page.tsx          # Hope x concern analysis
│   ├── trends/page.tsx            # Sentiment + velocity trends
│   ├── globe/page.tsx             # World map (Phase 2)
│   └── settings/page.tsx          # Keywords + config
├── login/page.tsx
├── layout.tsx
└── page.tsx                       # Redirect to /dashboard
```

### Cron configuration (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

### Cron handler (`app/api/cron/route.ts`)

```typescript
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = await createIngestionLog();

  try {
    // 1. Ingest
    const rawMentions = await Promise.all([
      ingestHackerNews(),
      ingestReddit(),
      ingestRSS(),
    ]);
    const allMentions = rawMentions.flat();

    // 2. Deduplicate and insert
    const newMentions = await insertNewMentions(allMentions);

    // 3. Classify (includes tension + region)
    const classified = await classifyBatch(newMentions);
    await updateMentionsWithClassifications(newMentions, classified);

    // 4. Update velocity for recent mentions
    await updateEngagementSnapshots();

    // 5. Fire alerts
    const { data: currentFires } = await supabase
      .from("mentions")
      .select("*")
      .eq("urgency", "fire")
      .eq("is_reviewed", false)
      .gte("published_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (currentFires && currentFires.length > 0) {
      await sendFireAlert(currentFires);
    }

    // 6. Morning brief at 7am PT
    const hour = new Date().getUTCHours();
    if (hour === 15) {
      await generateDailyBrief();
    }

    await completeIngestionLog(log.id, {
      mentions_found: allMentions.length,
      mentions_new: newMentions.length,
      mentions_classified: classified.length,
    });

    return Response.json({ success: true, new: newMentions.length, classified: classified.length });
  } catch (error) {
    await failIngestionLog(log.id, error);
    return Response.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
```

---

## 8. Morning brief generator

See `lib/brief.ts`. The brief now includes:
- Fires (with velocity flags)
- Accelerating posts (could become fires)
- Moments worth amplifying
- Tensions (developers expressing both hope AND concern)
- Signals to track
- Competitor radar
- Stats including hope/concern quadrant split

The brief synthesis prompt and function are implemented in the same pattern as v1.0, with the additional tension and velocity data passed to Claude for synthesis. See the full implementation in the codebase.

---

## 9. Dashboard UI spec

### Design system

- **Font:** System font stack
- **Colors:** White bg, gray-50 surfaces, semantic colors only
  - Fire: `red-500` badge, `red-50` bg
  - Moment: `amber-500` badge, `amber-50` bg
  - Signal: `blue-500` badge, `blue-50` bg
  - Noise: `gray-400` badge
  - Accelerating: pulsing `orange-500` dot
  - Tension detected: `purple-500` left border accent
  - Hope: `emerald-500`
  - Concern: `rose-500`
  - Competitor: `violet-500` dot
- **Layout:** Single-column feed with sidebar filters. Fast, scannable.
- **Responsive:** Desktop-first, mobile-usable.

### Mention card anatomy

Each card shows:
- Urgency badge (color pill) + velocity indicator (pulsing dot if accelerating, with pts/hr)
- Source icon + relative time
- Title/summary (1 line, bold)
- Engagement stats (points, comments)
- Hope/concern indicator: 3 dots for each (filled = score, e.g. `Hope: ●●○ Concern: ●●●`)
- Primary emotion tag (small gray pill)
- Tension badge (purple pill, only if tension_type != "none", shows type)
- Recommended action (gray text, 1 line)
- Click to expand: full body, raw link, review controls, notes

### Tensions view (`/dashboard/tensions`)

**Hope x Concern scatter plot:** Each dot = one mention. X = hope (0-3), Y = concern (0-3). Four quadrants labeled: Tensions (top-right), Alarms (top-left), Enthusiasm (bottom-right), Neutral (bottom-left). Dot size = log(engagement). Dot color = source. Click to see mention.

**Tension type breakdown:** Horizontal bars for the five tension types, filterable by time.

**Tension feed:** Mentions where tension_type != "none", sorted by engagement.

### Globe view (`/dashboard/globe`) — Phase 2

Regional sentiment choropleth using `react-simple-maps`. Color by net hope-concern. Bubble size = mention count. Click region → filtered feed.

### Other views

- **Brief** (`/dashboard/brief`): Rendered markdown, copy-to-clipboard, date picker, stats cards
- **Competitors** (`/dashboard/competitors`): Grouped by competitor, switching direction
- **Trends** (`/dashboard/trends`): Hope/concern over time (dual line), velocity events timeline, emotion distribution, mentions by source
- **Settings** (`/dashboard/settings`): Manage keywords, toggle sources

---

## 10. Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
YOUTUBE_API_KEY=
CRON_SECRET=
SLACK_WEBHOOK_URL=
```

---

## 11. Build phases

### Phase 1: Foundation (Day 1-2)

**Goal:** Database, auth, one source, classification with tension detection.

- [ ] Create Supabase project, run ALL migrations (mentions, engagement_snapshots, daily_briefs, keywords, ingestion_logs, RLS)
- [ ] Seed keywords table
- [ ] Set up Next.js 14 + Tailwind, deploy to Vercel
- [ ] Supabase Auth (email/password)
- [ ] `lib/types.ts` with all interfaces
- [ ] `lib/supabase.ts` with server + client helpers
- [ ] `lib/sources/hn.ts` — HN ingestion adapter
- [ ] `lib/classify.ts` — classification with full prompt
- [ ] `/api/ingest/hackernews` and `/api/classify` routes
- [ ] Test: ingest → classify → verify hope_score, concern_score, tension_type, inferred_region in DB

### Phase 2: Dashboard + sources + velocity (Day 3-5)

**Goal:** Working dashboard with tension dots and velocity badges, all sources, velocity tracking.

- [ ] Mention card component (urgency badge, hope/concern dots, velocity dot, tension accent)
- [ ] Main dashboard page with feed
- [ ] Filter sidebar (urgency, source, time, velocity, tension-only)
- [ ] `lib/sources/reddit.ts`, `lib/sources/youtube.ts`, `lib/sources/rss.ts`
- [ ] `lib/velocity.ts` — snapshot recording + velocity calculation
- [ ] `/api/velocity` route
- [ ] Wire Vercel Cron: ingest → classify → velocity
- [ ] `/api/mentions` GET with filters
- [ ] Mention expand/review UI

### Phase 3: Brief + analysis views (Day 6-8)

**Goal:** Morning brief, tensions page, competitor view, trends.

- [ ] `lib/brief.ts` — brief generator with tensions + velocity sections
- [ ] Brief view page + copy-to-clipboard
- [ ] Tensions page: scatter plot (recharts ScatterChart), tension bars, tension feed
- [ ] Competitor radar page
- [ ] Trends page (hope/concern lines, emotion bars, source breakdown)
- [ ] `lib/alerts.ts` — Slack webhook for fires
- [ ] Settings page (keywords, sources)

### Phase 4: Polish + globe + deploy (Day 9-10)

**Goal:** Production-ready, globe view, live data, shareable URL.

- [ ] Globe view (`react-simple-maps`, regional aggregation)
- [ ] Loading states, error handling, empty states
- [ ] Ingestion log viewer
- [ ] README with screenshots
- [ ] Seed 48+ hours of real data
- [ ] Pagination, caching
- [ ] Security review (RLS, auth, env vars)
- [ ] Deploy to `beacon.rachaelchew.com` or `getbeacon.vercel.app`
- [ ] Verify cron jobs in production

---

## 12. File ownership table (for parallel Claude Code agents)

| Agent | Files owned | Do NOT touch |
|-------|-------------|--------------|
| Agent 1 (DB + API) | `app/api/**`, `lib/supabase.ts`, `lib/types.ts`, `supabase/migrations/**` | `app/dashboard/**`, `components/**` |
| Agent 2 (Ingestion + Velocity) | `lib/sources/**`, `lib/classify.ts`, `lib/velocity.ts` | `app/dashboard/**`, `app/api/mentions/**` |
| Agent 3 (Dashboard UI) | `app/dashboard/**`, `components/**`, `app/layout.tsx` | `app/api/**`, `lib/sources/**` |
| Agent 4 (Brief + Alerts) | `lib/brief.ts`, `lib/alerts.ts`, `app/api/brief/**` | `app/dashboard/**`, `lib/sources/**` |
| Agent 5 (Polish + Integration) | Any file, ONLY after Agents 1-4 | N/A — fires last |

**Pre-flight:** `npm run build` before Agent 5 starts.

**Shared types:** All agents import from `lib/types.ts`. Only Agent 1 modifies it.

---

## 13. Cost estimate (monthly)

| Item | Cost |
|------|------|
| Vercel Pro | $20/mo |
| Supabase Free tier | $0 |
| Claude API (classification) | ~$17/mo |
| Claude API (briefs) | ~$3/mo |
| YouTube Data API | $0 |
| react-simple-maps | $0 |
| **Total** | **~$40/month** |

---

## 14. Testing commands

```bash
# Ingest from HN
curl -X POST http://localhost:3000/api/ingest/hackernews

# Classify unclassified
curl -X POST http://localhost:3000/api/classify

# Update velocity snapshots
curl -X POST http://localhost:3000/api/velocity

# Generate brief
curl -X POST http://localhost:3000/api/brief

# Full cron cycle
curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer ${CRON_SECRET}"

# Query mentions
curl "http://localhost:3000/api/mentions?urgency=fire&limit=5"
curl "http://localhost:3000/api/mentions?velocity_status=accelerating"
curl "http://localhost:3000/api/mentions?tension_type=empowerment_vs_displacement"
curl "http://localhost:3000/api/mentions?inferred_region=east-asia"

# Stats
curl "http://localhost:3000/api/stats/tensions?days=7"
curl "http://localhost:3000/api/stats/regions?days=30"
```

---

## 15. Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "tailwindcss": "^3.4.0",
    "recharts": "^2.12.0",
    "react-simple-maps": "^3.0.0",
    "rss-parser": "^3.13.0",
    "date-fns": "^3.6.0"
  }
}
```
