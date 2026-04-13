// ============================================================
// Union type literals
// ============================================================

export type SourceType = "hackernews" | "reddit" | "youtube" | "rss" | "twitter" | "discord" | "manual";

export type Urgency = "fire" | "moment" | "signal" | "noise";

export type TensionType =
  | "learning_vs_atrophy"
  | "time_savings_vs_treadmill"
  | "empowerment_vs_displacement"
  | "decision_support_vs_erosion"
  | "productivity_vs_dependency"
  | "none";

export type VelocityStatus = "accelerating" | "normal" | "decelerating" | "stale";

export type FlagType = "draft_response" | "share_with_product" | "case_study" | "include_in_brief";

export type PrimaryEmotion =
  | "excitement"
  | "frustration"
  | "fear"
  | "admiration"
  | "disappointment"
  | "curiosity"
  | "anger"
  | "relief"
  | "resignation"
  | "awe"
  | "skepticism"
  | "neutral";

export type CredibilitySignal = "high" | "medium" | "low" | "unknown";

export type InferredRegion =
  | "north-america"
  | "europe"
  | "east-asia"
  | "south-asia"
  | "southeast-asia"
  | "latin-america"
  | "middle-east"
  | "africa"
  | "oceania";

export type Topic =
  | "safety-alignment"
  | "developer-experience"
  | "enterprise-adoption"
  | "competitive-positioning"
  | "pricing-access"
  | "open-source-ecosystem"
  | "regulation-policy";

export type KeywordCategory = "primary" | "competitor" | "context";

export type HopeConcernScore = 0 | 1 | 2 | 3;

// ============================================================
// Core data interfaces
// ============================================================

export interface MentionRaw {
  source: SourceType;
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

export interface ClassificationInput {
  source: string;
  title: string;
  body: string;
  author: string;
  engagement_score: number;
  published_at: string;
}

export interface ClassificationOutput {
  urgency: Urgency;
  urgency_reason: string;
  summary: string;
  recommended_action: string;
  hope_score: HopeConcernScore;
  concern_score: HopeConcernScore;
  tension_type: TensionType;
  primary_emotion: string;
  topic: Topic | null;
  is_competitor_mention: boolean;
  competitor_names: string[];
  credibility_signal: CredibilitySignal;
  topics: string[];
  inferred_region: InferredRegion | null;
}

export interface VelocityResult {
  velocity_score: number;
  velocity_status: VelocityStatus;
}

// ============================================================
// Spokesperson prep types
// ============================================================

export interface PrepRequest {
  journalist_name: string;
  outlet: string;
  topic: string;
  engagement_date: string;
  engagement_type: "podcast" | "print" | "broadcast" | "panel" | "briefing" | "other";
  spokesperson: string;
  notes?: string;
}

export interface PrepDocument {
  id: string;
  created_at: string;
  request: PrepRequest;
  document: string;
  mention_count: number;
}

// ============================================================
// Database row types
// ============================================================

export interface MentionRow {
  id: string;
  source: SourceType;
  source_id: string;
  source_url: string;
  title: string | null;
  body: string | null;
  author: string | null;
  author_karma: number | null;
  engagement_score: number;
  published_at: string;
  fetched_at: string;
  classified_at: string | null;
  urgency: Urgency | null;
  urgency_reason: string | null;
  summary: string | null;
  recommended_action: string | null;
  hope_score: number;
  concern_score: number;
  tension_type: TensionType | null;
  primary_emotion: string | null;
  topic: Topic | null;
  is_competitor_mention: boolean;
  competitor_names: string[] | null;
  credibility_signal: CredibilitySignal | null;
  topics: string[] | null;
  inferred_region: InferredRegion | null;
  velocity_status: VelocityStatus;
  velocity_score: number;
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  is_bookmarked: boolean;
  flag_type: FlagType | null;
  raw_json: Record<string, unknown> | null;
  classification_raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EngagementSnapshotRow {
  id: string;
  mention_id: string;
  engagement_score: number;
  snapshot_at: string;
}

export interface DailyBriefRow {
  id: string;
  brief_date: string;
  fires_section: string | null;
  moments_section: string | null;
  signals_section: string | null;
  competitor_section: string | null;
  tension_section: string | null;
  stats_section: string | null;
  full_brief: string;
  mention_count: number | null;
  fire_count: number | null;
  moment_count: number | null;
  tension_count: number | null;
  generated_at: string;
  created_at: string;
}

export interface KeywordRow {
  id: string;
  keyword: string;
  category: KeywordCategory;
  is_active: boolean;
  created_at: string;
}

export interface IngestionLogRow {
  id: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  mentions_found: number;
  mentions_new: number;
  mentions_classified: number;
  error: string | null;
  duration_ms: number | null;
}

// ============================================================
// Pull-through scoring types
// ============================================================

export interface KeyMessageRow {
  id: string;
  message: string;
  shorthand: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PullthroughScoreRow {
  id: string;
  mention_id: string;
  message_id: string;
  score: number;
  evidence: string | null;
  scored_at: string;
}

export interface PullthroughResult {
  message_id: string;
  score: number;
  evidence: string | null;
}

export interface PrepDocumentRow {
  id: string;
  journalist_name: string;
  outlet: string;
  topic: string;
  engagement_date: string;
  engagement_type: string;
  spokesperson: string;
  notes: string | null;
  document: string;
  mention_count: number;
  created_at: string;
}

// ============================================================
// API response / request types
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  limit: number;
  offset: number;
}

export interface MentionFilters {
  urgency?: Urgency;
  source?: SourceType;
  velocity_status?: VelocityStatus;
  tension_type?: TensionType;
  inferred_region?: InferredRegion;
  time_range?: "1h" | "6h" | "24h" | "7d" | "30d" | "all";
  limit?: number;
  offset?: number;
}

export interface MentionPatchBody {
  is_reviewed?: boolean;
  reviewed_by?: string;
  notes?: string;
  is_bookmarked?: boolean;
  flag_type?: FlagType | null;
}

export interface TensionStatsResponse {
  distribution: Record<string, number>;
  averages: {
    date: string;
    avg_hope: number;
    avg_concern: number;
    tension_count: number;
  }[];
  total_tension_count: number;
}

export interface RegionStatsResponse {
  regions: {
    region: string;
    mention_count: number;
    avg_hope: number;
    avg_concern: number;
    fire_count: number;
    moment_count: number;
    net_sentiment: number;
    top_tension: string;
    top_topics: string[];
    top_emotions: string[];
    dominant_urgency: string;
    fires: { summary: string; source_url: string }[];
    recent_moments: { summary: string; source_url: string }[];
    narrative: string | null;
  }[];
}

export interface IngestionResult {
  source: SourceType;
  mentions_found: number;
  mentions_new: number;
  errors: string[];
}

// ============================================================
// Audience-specific briefs
// ============================================================

export interface Audience {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  slack_webhook_url: string | null;
  slack_channel_name: string | null;
  is_active: boolean;
  brief_schedule: string;
  brief_prompt_context: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentionAudienceRoute {
  id: string;
  mention_id: string;
  audience_slug: string;
  routed_by: 'auto' | 'manual';
  routed_at: string;
}

export interface AudienceBrief {
  id: string;
  audience_slug: string;
  brief_date: string;
  full_brief: string;
  mention_count: number;
  fire_count: number;
  generated_at: string;
}

export interface AudienceRelevance {
  slug: string;
  relevance: 0 | 1 | 2;
  reason: string;
}

export type ClassificationWithAudience = ClassificationOutput & {
  audience_relevance: AudienceRelevance[];
};

// ============================================================
// Narrative Command Center
// ============================================================

export interface NarrativePriority {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  target_pull_through: number;
  is_active: boolean;
  sort_order: number;
  quarter: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentionPullThrough {
  id: string;
  mention_id: string;
  narrative_slug: string;
  score: 0 | 1 | 2;
  framing: 'gain' | 'loss' | 'neutral';
  evidence: string | null;
  scored_at: string;
}

export interface JournalistProfile {
  id: string;
  name: string;
  outlet: string;
  slug: string;
  beat: string | null;
  email: string | null;
  twitter_handle: string | null;
  notes: string | null;
  first_seen_at: string;
  last_coverage_at: string | null;
  mention_count: number;
  created_at: string;
  updated_at: string;
  narrative_alignment?: Record<string, number>;
  relationship_health?: 'strong' | 'warm' | 'cold' | 'new';
  recent_sentiment?: number;
}

export interface NarrativeSnapshot {
  id: string;
  narrative_slug: string;
  week_start: string;
  total_press_mentions: number;
  scored_mentions: number;
  pull_through_count: number;
  strong_pull_through_count: number;
  pull_through_rate: number;
  avg_framing_sentiment: number;
  gain_count: number;
  loss_count: number;
  neutral_count: number;
  top_outlet: string | null;
  top_journalist: string | null;
  snapshot_at: string;
}

export interface NarrativeGap {
  id: string;
  detected_theme: string;
  description: string;
  mention_count: number;
  first_detected_at: string;
  last_seen_at: string;
  sample_mention_ids: string[];
  status: 'new' | 'reviewing' | 'adopted' | 'dismissed';
  recommendation: string | null;
  dismissed_reason: string | null;
}

export interface NarrativeReport {
  id: string;
  week_start: string;
  full_report: string;
  highlights: {
    winners: { slug: string; rate: number; delta: number }[];
    losers: { slug: string; rate: number; delta: number }[];
    gaps: { theme: string; count: number }[];
  };
  generated_at: string;
}

// ============================================================
// LLM Output Monitoring
// ============================================================

export type LLMPlatform = 'chatgpt' | 'gemini' | 'perplexity' | 'copilot' | 'meta-ai' | 'claude';

export type ProbeCategory = 'product-comparison' | 'safety-perception' | 'brand-reputation' |
  'technical-capability' | 'pricing' | 'competitor-positioning' | 'factual-accuracy';

export interface LLMProbe {
  id: string;
  prompt_text: string;
  category: ProbeCategory;
  target_entity: string;
  is_active: boolean;
  frequency: 'daily' | 'weekly';
  created_at: string;
}

export interface LLMResponse {
  id: string;
  probe_id: string;
  platform: LLMPlatform;
  response_text: string;
  response_date: string;
  model_version: string | null;
  fetched_at: string;
  probe?: LLMProbe;
  classification?: LLMResponseClassification;
}

export interface LLMResponseClassification {
  id: string;
  response_id: string;
  anthropic_mentioned: boolean;
  claude_mentioned: boolean;
  mention_sentiment: number;
  mention_context: string | null;
  narratives_reflected: { slug: string; present: boolean; framing: string }[];
  competitors_mentioned: { name: string; sentiment: number; positioned_as: string }[];
  competitors_favored: string[];
  anthropic_rank: number | null;
  factual_errors: { claim: string; reality: string; severity: string }[];
  has_critical_error: boolean;
  overall_score: number;
  analysis_summary: string | null;
  classified_at: string;
}

export interface LLMMonitoringSnapshot {
  id: string;
  week_start: string;
  platform: LLMPlatform;
  total_probes: number;
  anthropic_mention_rate: number;
  avg_sentiment: number;
  avg_rank: number | null;
  narrative_pull_through: Record<string, number>;
  top_competitor: string | null;
  error_count: number;
  critical_error_count: number;
  snapshot_at: string;
}

export interface LLMPlatformSummary {
  platform: LLMPlatform;
  mention_rate: number;
  avg_sentiment: number;
  avg_rank: number | null;
  top_narrative: string | null;
  critical_errors: number;
  trend: 'improving' | 'stable' | 'declining';
  last_checked: string;
}

// ============================================================
// War Room / Incident Management
// ============================================================

export type IncidentStatus = 'active' | 'monitoring' | 'resolved' | 'post-mortem';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentType = 'service-outage' | 'model-safety' | 'competitor-launch' |
  'data-concern' | 'employee-controversy' | 'regulatory-action' | 'research-critique' |
  'viral-misuse' | 'pricing-backlash' | 'security-vulnerability' | 'other';
export type DraftStatus = 'draft' | 'review' | 'approved' | 'sent' | 'archived';
export type ReviewerRole = 'comms' | 'legal' | 'executive' | 'engineering' | 'policy';
export type TemplateChannel = 'statement' | 'social' | 'internal' | 'press' | 'blog';

export interface Incident {
  id: string;
  title: string;
  slug: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  incident_type: IncidentType | null;
  summary: string | null;
  first_detected_at: string;
  resolved_at: string | null;
  resolution_summary: string | null;
  response_time_minutes: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  mention_count?: number;
  latest_mention_at?: string;
  active_draft_count?: number;
  stakeholder_progress?: { notified: number; total: number };
}

export interface ResponseTemplate {
  id: string;
  scenario_type: IncidentType;
  title: string;
  channel: TemplateChannel;
  template_body: string;
  placeholders: string[];
  is_active: boolean;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResponseDraft {
  id: string;
  incident_id: string;
  template_id: string | null;
  version: number;
  channel: TemplateChannel;
  title: string;
  body: string;
  status: DraftStatus;
  author: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  comments?: DraftComment[];
}

export interface DraftComment {
  id: string;
  draft_id: string;
  author: string;
  role: ReviewerRole;
  body: string;
  selection_start: number | null;
  selection_end: number | null;
  is_resolved: boolean;
  resolved_by: string | null;
  created_at: string;
}

export interface StakeholderChecklistItem {
  id: string;
  incident_id: string;
  stakeholder_name: string;
  stakeholder_role: string | null;
  notification_channel: string;
  priority_order: number;
  is_notified: boolean;
  notified_at: string | null;
  notified_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface PostIncidentReview {
  id: string;
  incident_id: string;
  what_happened: string | null;
  what_went_well: string | null;
  what_went_wrong: string | null;
  action_items: { action: string; owner: string; deadline: string; status: string }[];
  response_time_assessment: string | null;
  narrative_outcome: string | null;
  template_effectiveness: string | null;
  generated_by: string;
  reviewed_by: string | null;
  created_at: string;
}

// ============================================================
// Platform expansion types
// ============================================================

export interface TwitterMonitoredAccount {
  id: string;
  username: string;
  display_name: string | null;
  category: 'anthropic-official' | 'competitor-official' | 'ai-researcher' |
    'developer-advocate' | 'tech-journalist' | 'influencer' | 'general';
  twitter_user_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface TwitterSearchKeyword {
  id: string;
  keyword: string;
  category: 'primary' | 'competitor' | 'context';
  is_active: boolean;
  created_at: string;
}

export interface DiscordMonitoredChannel {
  id: string;
  server_name: string;
  server_id: string;
  channel_name: string;
  channel_id: string;
  category: 'anthropic-official' | 'competitor' | 'developer-community' |
    'ai-research' | 'general';
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface NarrativePropagation {
  id: string;
  cluster_title: string;
  cluster_keywords: string[];
  first_platform: string;
  first_mention_id: string | null;
  first_detected_at: string;
  platforms_reached: string[];
  mention_ids: string[];
  total_engagement: number;
  peak_velocity: string;
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields:
  mentions?: any[];              // populated by join
  spread_duration_minutes?: number; // time from first to latest platform
  platform_timeline?: {          // chronological platform appearance
    platform: string;
    first_seen: string;
    mention_count: number;
  }[];
}

export interface SourceTier {
  source: string;
  tier: number;
  display_name: string;
  icon: string;
  color: string;
}
