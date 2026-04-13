import type { VelocityResult } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase';

export const VELOCITY_BASELINES: Record<string, number> = {
  hackernews: 15,   // avg points/hour for a mention that reaches 50+ points
  reddit: 8,        // avg score/hour for a post that reaches 100+ upvotes
  youtube: 50,      // avg views/hour for a video that reaches 10K+
  twitter: 20,      // avg engagement/hour for a tweet reaching 100+ engagements
  rss: 0,           // RSS has no engagement score; skip velocity
  discord: 0,       // no public engagement re-fetch API
};

export const ACCELERATION_MULTIPLIER = 3; // 3x baseline = "accelerating"

export async function calculateVelocity(
  mentionId: string,
  source: string
): Promise<VelocityResult> {
  const { data: snapshots } = await supabaseAdmin
    .from('engagement_snapshots')
    .select('engagement_score, snapshot_at')
    .eq('mention_id', mentionId)
    .order('snapshot_at', { ascending: false })
    .limit(2);

  if (!snapshots || snapshots.length < 2) {
    return { velocity_score: 0, velocity_status: 'normal' };
  }

  const [latest, previous] = snapshots;
  const timeDiffHours =
    (new Date(latest.snapshot_at).getTime() - new Date(previous.snapshot_at).getTime()) /
    (1000 * 60 * 60);

  if (timeDiffHours === 0) return { velocity_score: 0, velocity_status: 'normal' };

  const velocity_score =
    (latest.engagement_score - previous.engagement_score) / timeDiffHours;
  const baseline = VELOCITY_BASELINES[source] || 10;

  let velocity_status: VelocityResult['velocity_status'];
  if (velocity_score >= baseline * ACCELERATION_MULTIPLIER) {
    velocity_status = 'accelerating';
  } else if (velocity_score <= 0) {
    velocity_status = 'decelerating';
  } else if (velocity_score < baseline * 0.1) {
    velocity_status = 'stale';
  } else {
    velocity_status = 'normal';
  }

  return { velocity_score, velocity_status };
}

export async function updateEngagementSnapshots(): Promise<void> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: recentMentions } = await supabaseAdmin
    .from('mentions')
    .select('id, source, source_id, engagement_score')
    .gte('published_at', sixHoursAgo)
    .in('source', ['hackernews', 'reddit', 'twitter']);

  if (!recentMentions) return;

  for (const mention of recentMentions) {
    let currentScore: number;

    try {
      if (mention.source === 'hackernews') {
        const res = await fetch(
          `https://hn.algolia.com/api/v1/items/${mention.source_id}`
        );
        if (!res.ok) continue;
        const item = await res.json();
        currentScore = (item.points || 0) + (item.children?.length || 0);
      } else if (mention.source === 'reddit') {
        const res = await fetch(
          `https://www.reddit.com/comments/${mention.source_id}.json`,
          { headers: { 'User-Agent': 'Beacon/1.0' } }
        );
        if (!res.ok) continue;
        const data = await res.json();
        const post = data?.[0]?.data?.children?.[0]?.data;
        currentScore = post
          ? post.score + post.num_comments
          : mention.engagement_score;
      } else if (mention.source === 'twitter') {
        const bearerToken = process.env.TWITTER_BEARER_TOKEN;
        if (!bearerToken) continue;
        const res = await fetch(
          `https://api.twitter.com/2/tweets/${mention.source_id}?tweet.fields=public_metrics`,
          { headers: { Authorization: `Bearer ${bearerToken}` } }
        );
        if (!res.ok) continue;
        const twitterData = await res.json();
        const metrics = twitterData.data?.public_metrics;
        currentScore = metrics
          ? metrics.like_count + metrics.retweet_count + metrics.reply_count + (metrics.quote_count || 0)
          : mention.engagement_score;
      } else {
        continue;
      }
    } catch (error) {
      console.error(
        `Failed to fetch engagement for ${mention.source}/${mention.source_id}:`,
        error
      );
      continue;
    }

    // Insert snapshot
    await supabaseAdmin.from('engagement_snapshots').insert({
      mention_id: mention.id,
      engagement_score: currentScore,
    });

    // Update mention current score
    await supabaseAdmin
      .from('mentions')
      .update({ engagement_score: currentScore })
      .eq('id', mention.id);

    // Calculate and update velocity
    const velocity = await calculateVelocity(mention.id, mention.source);
    await supabaseAdmin
      .from('mentions')
      .update({
        velocity_status: velocity.velocity_status,
        velocity_score: velocity.velocity_score,
      })
      .eq('id', mention.id);

    // Auto-promote to fire if accelerating
    if (velocity.velocity_status === 'accelerating') {
      const { data: m } = await supabaseAdmin
        .from('mentions')
        .select('urgency')
        .eq('id', mention.id)
        .single();

      if (m && m.urgency !== 'fire') {
        await supabaseAdmin
          .from('mentions')
          .update({
            urgency: 'fire',
            urgency_reason: `Engagement accelerating at ${velocity.velocity_score.toFixed(1)} pts/hr (${ACCELERATION_MULTIPLIER}x baseline)`,
          })
          .eq('id', mention.id);
      }
    }

    // Rate limit delay between mention updates
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
