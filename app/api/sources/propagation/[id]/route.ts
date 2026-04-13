import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: cluster, error } = await supabaseAdmin
      .from("propagation_clusters")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Cluster not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    // Fetch mention IDs from junction table
    const { data: junctionRows } = await supabaseAdmin
      .from("propagation_cluster_mentions")
      .select("mention_id")
      .eq("cluster_id", id);

    const mentionIds = (junctionRows || []).map(
      (r: { mention_id: string }) => r.mention_id
    );

    // Fetch full mention objects
    let mentions: Record<string, unknown>[] = [];
    if (mentionIds.length > 0) {
      const { data: mentionData } = await supabaseAdmin
        .from("mentions")
        .select(
          "id, title, summary, source, source_url, author, published_at, engagement_score, urgency"
        )
        .in("id", mentionIds)
        .order("published_at", { ascending: false });

      mentions = mentionData || [];
    }

    // spread_duration_minutes
    let spreadDuration = 0;
    if (mentions.length > 0) {
      const latestPublished = mentions.reduce(
        (max: string, m: Record<string, unknown>) =>
          (m.published_at as string) > max
            ? (m.published_at as string)
            : max,
        mentions[0].published_at as string
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
      const platformMentions = mentions.filter(
        (m) => m.source === platform
      );
      if (platformMentions.length > 0) {
        const firstSeen = platformMentions.reduce(
          (min: string, m: Record<string, unknown>) =>
            (m.published_at as string) < min
              ? (m.published_at as string)
              : min,
          platformMentions[0].published_at as string
        );
        const totalEng = platformMentions.reduce(
          (sum, m) => sum + ((m.engagement_score as number) || 0),
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

    // Determine status
    const hoursSinceUpdate =
      (Date.now() - new Date(cluster.updated_at).getTime()) / (1000 * 60 * 60);
    let status: "active" | "slowing" | "resolved" = "active";
    if (!cluster.is_active) status = "resolved";
    else if (hoursSinceUpdate > 2) status = "slowing";

    const hasFire = mentions.some((m) => m.urgency === "fire");

    return NextResponse.json({
      id: cluster.id,
      cluster_title: cluster.title,
      cluster_keywords: cluster.cluster_keywords,
      first_platform: cluster.first_platform,
      platforms_reached: cluster.platforms_reached,
      total_engagement: cluster.total_engagement,
      status,
      has_fire: hasFire,
      mention_ids: mentionIds,
      mentions,
      spread_duration_minutes: spreadDuration,
      platform_timeline: platformTimeline,
      created_at: cluster.created_at,
      updated_at: cluster.updated_at,
    });
  } catch (error) {
    console.error("GET /api/sources/propagation/[id] error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch cluster",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowed = ["title", "cluster_keywords", "is_active"];
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        filtered[key] = body[key];
      }
    }
    // Also support cluster_title as alias for title
    if (body.cluster_title !== undefined) {
      filtered.title = body.cluster_title;
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Auto-set resolved_at when deactivating
    if (filtered.is_active === false && !body.resolved_at) {
      filtered.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("propagation_clusters")
      .update(filtered)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Cluster not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/sources/propagation/[id] error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update cluster",
      },
      { status: 500 }
    );
  }
}
