import { supabaseAdmin } from "@/lib/supabase";
import type { AudienceRelevance } from "@/lib/types";

const ALL_AUDIENCES = ["comms", "product", "engineering", "safety", "policy", "executive"];

/**
 * Routes a mention to audiences based on classification results.
 * Only routes if relevance >= 1.
 * Fires (urgency === 'fire') are auto-routed to ALL audiences.
 */
export async function routeMentionToAudiences(
  mentionId: string,
  audienceRelevance: AudienceRelevance[],
  urgency: string
): Promise<void> {
  const routes: { mention_id: string; audience_slug: string; routed_by: string }[] = [];

  if (urgency === "fire") {
    for (const slug of ALL_AUDIENCES) {
      routes.push({ mention_id: mentionId, audience_slug: slug, routed_by: "auto" });
    }
  } else {
    // Always route to comms
    routes.push({ mention_id: mentionId, audience_slug: "comms", routed_by: "auto" });

    for (const ar of audienceRelevance) {
      if (ar.relevance >= 1 && ar.slug !== "comms") {
        routes.push({ mention_id: mentionId, audience_slug: ar.slug, routed_by: "auto" });
      }
    }
  }

  if (routes.length > 0) {
    const { error } = await supabaseAdmin
      .from("mention_audience_routes")
      .upsert(routes, { onConflict: "mention_id,audience_slug" });

    if (error) {
      console.error(`Failed to route mention ${mentionId}:`, error);
    }
  }
}

/**
 * Manually route a mention to an audience (from the UI tagging workflow).
 */
export async function manualRouteToAudience(
  mentionId: string,
  audienceSlug: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("mention_audience_routes")
    .upsert(
      { mention_id: mentionId, audience_slug: audienceSlug, routed_by: "manual" },
      { onConflict: "mention_id,audience_slug" }
    );

  if (error) {
    console.error(`Failed to manually route mention ${mentionId}:`, error);
  }
}

/**
 * Remove a manual route (user un-tags a mention).
 */
export async function removeManualRoute(
  mentionId: string,
  audienceSlug: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("mention_audience_routes")
    .delete()
    .eq("mention_id", mentionId)
    .eq("audience_slug", audienceSlug)
    .eq("routed_by", "manual");

  if (error) {
    console.error(`Failed to remove manual route for ${mentionId}:`, error);
  }
}
