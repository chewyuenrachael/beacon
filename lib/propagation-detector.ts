// ============================================================
// Propagation Detector — cross-platform story tracking
// ============================================================

import { supabaseAdmin } from "@/lib/supabase";

// ── Constants ────────────────────────────────────────────────

const OVERLAP_THRESHOLD = 0.4;
const STALE_HOURS = 24;
const RAPID_SPREAD_PLATFORMS = 3;
const RAPID_SPREAD_HOURS = 2;
const RAPID_SPREAD_ENGAGEMENT = 100;

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "has",
  "her", "was", "one", "our", "out", "his", "its", "how", "man", "new",
  "now", "old", "see", "way", "who", "did", "get", "let", "say", "she",
  "too", "use", "been", "have", "from", "with", "they", "this", "that",
  "will", "what", "when", "make", "like", "just", "over", "such", "take",
  "than", "them", "very", "some", "more", "also", "into", "most", "only",
  "come", "made", "each", "then", "want", "does", "here", "much", "many",
  "well", "back", "been", "your", "about", "would", "could", "should",
  "there", "their", "which", "other", "after", "these", "being", "where",
  "those", "every", "still", "think", "really",
]);

// Common domain words that cause false positives
const DOMAIN_STOPWORDS = new Set([
  "claude", "anthropic", "code", "model", "using", "work", "tool",
  "good", "great", "better", "best", "really", "thing", "things",
]);

// ── Types ────────────────────────────────────────────────────

interface RecentMention {
  id: string;
  source: string;
  title: string;
  body: string;
  engagement_score: number;
  published_at: string;
}

interface ActiveCluster {
  id: string;
  title: string;
  cluster_keywords: string[];
  first_platform: string;
  platforms_reached: string[];
  total_engagement: number;
  created_at: string;
  updated_at: string;
  mention_ids: string[];
}

// ── Utilities ────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractSignificantWords(text: string): Set<string> {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !STOPWORDS.has(w) &&
        !DOMAIN_STOPWORDS.has(w)
    );
  return new Set(words);
}

function computeKeywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  return intersection / Math.min(a.size, b.size);
}

function getTopKeywords(words: Set<string>, limit: number = 8): string[] {
  return Array.from(words).slice(0, limit);
}

function getOverlappingWords(a: Set<string>, b: Set<string>): string[] {
  const overlap: string[] = [];
  for (const word of a) {
    if (b.has(word)) overlap.push(word);
  }
  return overlap;
}

// ── Haiku title generation ───────────────────────────────────

async function generateClusterTitle(
  title1: string,
  title2: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: use first title truncated
    return title1.slice(0, 60);
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 30,
        messages: [
          {
            role: "user",
            content: `Summarize this story in 5-8 words: ${title1} / ${title2}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.content && data.content[0]) {
      return data.content[0].text.trim();
    }
    return title1.slice(0, 60);
  } catch (e) {
    console.error("[propagation] Haiku title generation failed:", e);
    return title1.slice(0, 60);
  }
}

// ── Main detection ───────────────────────────────────────────

export async function detectPropagation(): Promise<{
  new_clusters: number;
  updated_clusters: number;
  resolved_clusters: number;
}> {
  const sixHoursAgo = new Date(
    Date.now() - 6 * 60 * 60 * 1000
  ).toISOString();

  // 1. Fetch recent mentions (all sources)
  const { data: recentMentions } = await supabaseAdmin
    .from("mentions")
    .select("id, source, title, body, engagement_score, published_at")
    .gte("published_at", sixHoursAgo)
    .not("classified_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(200);

  if (!recentMentions || recentMentions.length === 0) {
    return { new_clusters: 0, updated_clusters: 0, resolved_clusters: 0 };
  }

  // 2. Fetch active clusters with their mention IDs
  const { data: activeClusters } = await supabaseAdmin
    .from("propagation_clusters")
    .select("id, title, cluster_keywords, first_platform, platforms_reached, total_engagement, created_at, updated_at")
    .eq("is_active", true);

  const clusters: ActiveCluster[] = [];
  for (const c of activeClusters || []) {
    const { data: clusterMentionRows } = await supabaseAdmin
      .from("propagation_cluster_mentions")
      .select("mention_id")
      .eq("cluster_id", c.id);

    clusters.push({
      ...c,
      mention_ids: (clusterMentionRows || []).map(
        (r: { mention_id: string }) => r.mention_id
      ),
    });
  }

  // Track which mentions are already in a cluster
  const mentionToCluster = new Map<string, string>();
  for (const cluster of clusters) {
    for (const mid of cluster.mention_ids) {
      mentionToCluster.set(mid, cluster.id);
    }
  }

  // Pre-compute keywords for each mention
  const mentionKeywords = new Map<string, Set<string>>();
  for (const m of recentMentions) {
    mentionKeywords.set(
      m.id,
      extractSignificantWords(`${m.title || ""} ${m.body || ""}`)
    );
  }

  let newClusters = 0;
  let updatedClusters = 0;

  // 3. Process unclustered mentions
  const unclustered = recentMentions.filter(
    (m) => !mentionToCluster.has(m.id)
  );

  for (const mention of unclustered) {
    if (mentionToCluster.has(mention.id)) continue; // may have been clustered during this loop

    const mKeywords = mentionKeywords.get(mention.id);
    if (!mKeywords || mKeywords.size < 3) continue; // too few keywords to cluster

    // 3a. Compare against existing clusters
    let matched = false;
    for (const cluster of clusters) {
      const clusterWords = new Set(cluster.cluster_keywords);
      const overlap = computeKeywordOverlap(mKeywords, clusterWords);

      if (
        overlap >= OVERLAP_THRESHOLD &&
        !cluster.platforms_reached.includes(mention.source)
      ) {
        // Add to existing cluster
        await supabaseAdmin.from("propagation_cluster_mentions").insert({
          cluster_id: cluster.id,
          mention_id: mention.id,
        });

        const newPlatforms = [
          ...new Set([...cluster.platforms_reached, mention.source]),
        ];
        const newEngagement =
          cluster.total_engagement + mention.engagement_score;

        await supabaseAdmin
          .from("propagation_clusters")
          .update({
            platforms_reached: newPlatforms,
            total_engagement: newEngagement,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cluster.id);

        cluster.platforms_reached = newPlatforms;
        cluster.total_engagement = newEngagement;
        cluster.mention_ids.push(mention.id);
        mentionToCluster.set(mention.id, cluster.id);
        updatedClusters++;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // 3b. Compare against other unclustered mentions from DIFFERENT platforms
    for (const other of unclustered) {
      if (other.id === mention.id) continue;
      if (mentionToCluster.has(other.id)) continue;
      if (other.source === mention.source) continue; // must be different platform

      const oKeywords = mentionKeywords.get(other.id);
      if (!oKeywords || oKeywords.size < 3) continue;

      const overlap = computeKeywordOverlap(mKeywords, oKeywords);
      if (overlap < OVERLAP_THRESHOLD) continue;

      // Create new cluster
      const overlapping = getOverlappingWords(mKeywords, oKeywords);
      const title = await generateClusterTitle(
        mention.title || mention.body.slice(0, 100),
        other.title || other.body.slice(0, 100)
      );

      const earlierMention =
        new Date(mention.published_at) < new Date(other.published_at)
          ? mention
          : other;

      const platforms = [
        ...new Set([mention.source, other.source]),
      ];

      const { data: newCluster, error: clusterError } = await supabaseAdmin
        .from("propagation_clusters")
        .insert({
          title,
          cluster_keywords: overlapping,
          first_platform: earlierMention.source,
          platforms_reached: platforms,
          total_engagement:
            mention.engagement_score + other.engagement_score,
        })
        .select("id")
        .single();

      if (clusterError || !newCluster) {
        console.error("[propagation] Failed to create cluster:", clusterError);
        continue;
      }

      // Link both mentions
      await supabaseAdmin.from("propagation_cluster_mentions").insert([
        { cluster_id: newCluster.id, mention_id: mention.id },
        { cluster_id: newCluster.id, mention_id: other.id },
      ]);

      mentionToCluster.set(mention.id, newCluster.id);
      mentionToCluster.set(other.id, newCluster.id);

      clusters.push({
        id: newCluster.id,
        title,
        cluster_keywords: overlapping,
        first_platform: earlierMention.source,
        platforms_reached: platforms,
        total_engagement:
          mention.engagement_score + other.engagement_score,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        mention_ids: [mention.id, other.id],
      });

      newClusters++;
      await delay(300); // Throttle Haiku calls
      break; // Move to next unclustered mention
    }
  }

  // 4. Resolve stale clusters
  const staleThreshold = new Date(
    Date.now() - STALE_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: staleClusters } = await supabaseAdmin
    .from("propagation_clusters")
    .select("id")
    .eq("is_active", true)
    .lt("updated_at", staleThreshold);

  let resolvedClusters = 0;
  if (staleClusters && staleClusters.length > 0) {
    const staleIds = staleClusters.map((c: { id: string }) => c.id);
    await supabaseAdmin
      .from("propagation_clusters")
      .update({
        is_active: false,
        resolved_at: new Date().toISOString(),
      })
      .in("id", staleIds);

    resolvedClusters = staleIds.length;
  }

  // 5. Fire detection for rapidly spreading narratives
  const rapidThreshold = new Date(
    Date.now() - RAPID_SPREAD_HOURS * 60 * 60 * 1000
  ).toISOString();

  for (const cluster of clusters) {
    if (!cluster.platforms_reached) continue;
    if (cluster.platforms_reached.length < RAPID_SPREAD_PLATFORMS) continue;
    if (cluster.total_engagement < RAPID_SPREAD_ENGAGEMENT) continue;

    // Check if created recently (rapid spread)
    if (cluster.created_at < rapidThreshold) continue;

    console.log(
      `[propagation] Narrative propagation detected: '${cluster.title}' across ${cluster.platforms_reached.join(", ")} (${cluster.total_engagement} total engagement)`
    );

    // Check if any linked mention is already a fire
    if (cluster.mention_ids.length > 0) {
      const { data: linkedMentions } = await supabaseAdmin
        .from("mentions")
        .select("id, urgency, engagement_score")
        .in("id", cluster.mention_ids)
        .order("engagement_score", { ascending: false });

      if (linkedMentions) {
        const hasFireAlready = linkedMentions.some(
          (m: { urgency: string | null }) => m.urgency === "fire"
        );

        if (!hasFireAlready && linkedMentions.length > 0) {
          // Upgrade most-engaged mention to fire
          const top = linkedMentions[0];
          await supabaseAdmin
            .from("mentions")
            .update({
              urgency: "fire",
              urgency_reason: `Narrative propagation: '${cluster.title}' detected across ${cluster.platforms_reached.length} platforms with ${cluster.total_engagement} total engagement`,
            })
            .eq("id", top.id);

          console.log(
            `[propagation] Upgraded mention ${top.id} to fire urgency`
          );
        }
      }
    }
  }

  return {
    new_clusters: newClusters,
    updated_clusters: updatedClusters,
    resolved_clusters: resolvedClusters,
  };
}
