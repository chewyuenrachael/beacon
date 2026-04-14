import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const activeOnly = params.get("active_only") !== "false";
    const includeMentions = params.get("include_mentions") === "true";

    let query = supabaseAdmin
      .from("propagation_clusters")
      .select("*")
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: clusters, error } = await query;
    if (error) throw error;

    const allClusters = clusters || [];
    if (allClusters.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch mention IDs for each cluster from junction table
    const clusterIds = allClusters.map((c) => c.id);
    const { data: clusterMentionRows } = await supabaseAdmin
      .from("propagation_cluster_mentions")
      .select("cluster_id, mention_id")
      .in("cluster_id", clusterIds);

    const clusterMentionMap = new Map<string, string[]>();
    for (const row of clusterMentionRows || []) {
      const existing = clusterMentionMap.get(row.cluster_id) || [];
      existing.push(row.mention_id);
      clusterMentionMap.set(row.cluster_id, existing);
    }

    // Collect all mention_ids across clusters
    const allMentionIds = [
      ...new Set((clusterMentionRows || []).map((r) => r.mention_id)),
    ];

    let mentionMap: Record<
      string,
      { source: string; published_at: string; engagement_score: number }
    > = {};
    let fullMentionMap: Record<string, Record<string, unknown>> = {};

    if (allMentionIds.length > 0) {
      const { data: mentions } = await supabaseAdmin
        .from("mentions")
        .select(
          "id, title, summary, source, source_url, author, published_at, engagement_score, urgency"
        )
        .in("id", allMentionIds);

      for (const m of mentions || []) {
        mentionMap[m.id] = {
          source: m.source,
          published_at: m.published_at,
          engagement_score: m.engagement_score,
        };
        if (includeMentions) {
          fullMentionMap[m.id] = m as Record<string, unknown>;
        }
      }
    }

    const enriched = allClusters.map((cluster) => {
      const mentionIds = clusterMentionMap.get(cluster.id) || [];
      const clusterMentions = mentionIds
        .map((id) => mentionMap[id])
        .filter(Boolean);

      // spread_duration_minutes
      let spreadDuration = 0;
      if (clusterMentions.length > 0) {
        const latestPublished = clusterMentions.reduce(
          (max: string, m: { published_at: string }) =>
            m.published_at > max ? m.published_at : max,
          clusterMentions[0].published_at
        );
        spreadDuration = Math.max(
          0,
          Math.round(
            (new Date(latestPublished).getTime() -
              new Date(cluster.created_at).getTime()) /
              60000
          )
        );
      }

      // platform_timeline
      const platformTimeline: {
        platform: string;
        first_seen: string;
        mention_count: number;
        total_engagement: number;
      }[] = [];
      for (const platform of cluster.platforms_reached || []) {
        const platformMentions = mentionIds
          .map((id) => mentionMap[id])
          .filter((m) => m && m.source === platform);
        if (platformMentions.length > 0) {
          const firstSeen = platformMentions.reduce(
            (min: string, m: { published_at: string }) =>
              m.published_at < min ? m.published_at : min,
            platformMentions[0].published_at
          );
          const totalEng = platformMentions.reduce(
            (sum, m) => sum + (m.engagement_score || 0),
            0
          );
          platformTimeline.push({
            platform,
            first_seen: firstSeen,
            mention_count: platformMentions.length,
            total_engagement: totalEng,
          });
        }
      }
      platformTimeline.sort((a, b) =>
        a.first_seen.localeCompare(b.first_seen)
      );

      // Determine status based on updated_at
      const hoursSinceUpdate =
        (Date.now() - new Date(cluster.updated_at).getTime()) / (1000 * 60 * 60);
      let status: "active" | "slowing" | "resolved" = "active";
      if (!cluster.is_active) status = "resolved";
      else if (hoursSinceUpdate > 6) status = "slowing";
      else if (hoursSinceUpdate > 2) status = "slowing";

      // Check if any mention is a fire
      const hasFire = mentionIds.some(
        (id) => fullMentionMap[id]?.urgency === "fire"
      );

      const result: Record<string, unknown> = {
        id: cluster.id,
        cluster_title: cluster.title,
        cluster_keywords: cluster.cluster_keywords,
        first_platform: cluster.first_platform,
        platforms_reached: cluster.platforms_reached,
        total_engagement: cluster.total_engagement,
        status,
        has_fire: hasFire,
        mention_ids: mentionIds,
        spread_duration_minutes: spreadDuration,
        platform_timeline: platformTimeline,
        created_at: cluster.created_at,
        updated_at: cluster.updated_at,
      };

      if (includeMentions) {
        result.mentions = mentionIds
          .map((id) => fullMentionMap[id])
          .filter(Boolean);
      }

      return result;
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/sources/propagation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch propagation clusters",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.cluster_title || typeof body.cluster_title !== "string") {
      return NextResponse.json(
        { error: "cluster_title is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.mention_ids) || body.mention_ids.length === 0) {
      return NextResponse.json(
        { error: "mention_ids must be a non-empty array" },
        { status: 400 }
      );
    }

    // Fetch linked mentions to auto-populate fields
    const { data: mentions } = await supabaseAdmin
      .from("mentions")
      .select("id, source, published_at, engagement_score")
      .in("id", body.mention_ids);

    if (!mentions || mentions.length === 0) {
      return NextResponse.json(
        { error: "No valid mentions found for the provided mention_ids" },
        { status: 400 }
      );
    }

    mentions.sort((a, b) => a.published_at.localeCompare(b.published_at));
    const firstMention = mentions[0];
    const platformsReached = [...new Set(mentions.map((m) => m.source))];
    const totalEngagement = mentions.reduce(
      (sum, m) => sum + (m.engagement_score || 0),
      0
    );

    const { data, error } = await supabaseAdmin
      .from("propagation_clusters")
      .insert({
        title: body.cluster_title,
        cluster_keywords: body.cluster_keywords || [],
        first_platform: firstMention.source,
        platforms_reached: platformsReached,
        total_engagement: totalEngagement,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert junction rows
    const junctionRows = body.mention_ids.map((mid: string) => ({
      cluster_id: data.id,
      mention_id: mid,
    }));
    await supabaseAdmin
      .from("propagation_cluster_mentions")
      .insert(junctionRows);

    return NextResponse.json(
      { ...data, mention_ids: body.mention_ids },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/sources/propagation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create propagation cluster",
      },
      { status: 500 }
    );
  }
}
