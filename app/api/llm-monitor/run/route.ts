import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { LLMPlatform } from "@/lib/types";

const ALL_PLATFORMS: LLMPlatform[] = [
  "chatgpt", "gemini", "perplexity", "copilot", "meta-ai", "claude",
];

export async function POST(request: NextRequest) {
  try {
    // Auth check (soft — allows dev without CRON_SECRET)
    const authHeader = request.headers.get("authorization");
    if (authHeader && process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const platforms: LLMPlatform[] = body.platforms || ALL_PLATFORMS;
    const probeIds: string[] | undefined = body.probe_ids;

    // Dynamic import of fetcher
    type FetchResult = { probe_id: string; platform: string; response_text: string; model_version: string; stored_id: string | null };
    let fetchLLMResponses: (
      probes: { id: string; prompt_text: string }[],
      platforms: string[]
    ) => Promise<FetchResult[]>;

    try {
      const mod = await import("@/lib/llm-fetcher");
      fetchLLMResponses = mod.fetchLLMResponses;
    } catch {
      return NextResponse.json(
        { error: "LLM fetcher module not yet available" },
        { status: 501 }
      );
    }

    // Dynamic import of classifier
    type ClassifyInput = { id: string; probe_id: string; platform: string; response_text: string; probe_prompt: string; probe_category: string };
    let classifyLLMResponse: (input: ClassifyInput) => Promise<unknown>;

    try {
      const mod = await import("@/lib/llm-classifier");
      classifyLLMResponse = mod.classifyLLMResponse;
    } catch {
      return NextResponse.json(
        { error: "LLM classifier module not yet available" },
        { status: 501 }
      );
    }

    // Fetch probes
    let probeQuery = supabaseAdmin
      .from("llm_probes")
      .select("id, prompt_text, category")
      .eq("is_active", true);

    if (probeIds && probeIds.length > 0) {
      probeQuery = probeQuery.in("id", probeIds);
    }

    const { data: probes, error: probeError } = await probeQuery;
    if (probeError) throw probeError;

    if (!probes || probes.length === 0) {
      return NextResponse.json({
        fetched: 0,
        classified: 0,
        errors: 0,
        critical_errors: 0,
        message: "No active probes found",
      });
    }

    // Run fetcher
    const fetchResults = await fetchLLMResponses(probes, platforms);
    const fetched = fetchResults.filter((r) => r.stored_id).length;
    const fetchErrors = fetchResults.filter((r) => !r.stored_id).length;

    // Build probe lookup for classifier input
    const probeMap = new Map(probes.map((p) => [p.id, p]));

    // Run classifier on each stored response
    let classified = 0;
    let criticalErrors = 0;

    for (const result of fetchResults) {
      if (!result.stored_id) continue;

      const probe = probeMap.get(result.probe_id);
      if (!probe) continue;

      try {
        const classification = await classifyLLMResponse({
          id: result.stored_id,
          probe_id: result.probe_id,
          platform: result.platform,
          response_text: result.response_text,
          probe_prompt: probe.prompt_text,
          probe_category: probe.category,
        });

        classified++;

        // Check for critical errors in the classification result
        if (classification && typeof classification === "object" && "has_critical_error" in classification) {
          if ((classification as { has_critical_error: boolean }).has_critical_error) {
            criticalErrors++;
          }
        }
      } catch (err) {
        console.error(`[llm-monitor/run] Classification failed for ${result.stored_id}:`, err);
      }
    }

    return NextResponse.json({
      fetched,
      classified,
      errors: fetchErrors,
      critical_errors: criticalErrors,
    });
  } catch (error) {
    console.error("POST /api/llm-monitor/run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Monitoring run failed" },
      { status: 500 }
    );
  }
}
