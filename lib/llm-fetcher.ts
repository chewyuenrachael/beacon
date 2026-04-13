import { supabaseAdmin } from "@/lib/supabase";

interface LLMProbe {
  id: string;
  prompt_text: string;
}

interface LLMResponseResult {
  probe_id: string;
  platform: string;
  response_text: string;
  model_version: string;
  stored_id: string | null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

const PLATFORM_CONFIG: Record<
  string,
  { envKey: string; defaultModel: string }
> = {
  perplexity: { envKey: "PERPLEXITY_API_KEY", defaultModel: "sonar" },
  chatgpt: { envKey: "OPENAI_API_KEY", defaultModel: "gpt-4o-mini" },
  gemini: { envKey: "GOOGLE_AI_API_KEY", defaultModel: "gemini-2.0-flash" },
  claude: { envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-20250514" },
};

async function queryPlatform(
  platform: string,
  promptText: string
): Promise<{ response_text: string; model_version: string }> {
  const config = PLATFORM_CONFIG[platform];
  if (!config) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new Error("MISSING_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    switch (platform) {
      case "perplexity": {
        const response = await fetch(
          "https://api.perplexity.ai/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [{ role: "user", content: promptText }],
            }),
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return {
          response_text: data.choices?.[0]?.message?.content ?? "",
          model_version: data.model || "sonar",
        };
      }

      case "chatgpt": {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: promptText }],
            }),
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return {
          response_text: data.choices?.[0]?.message?.content ?? "",
          model_version: data.model || "gpt-4o-mini",
        };
      }

      case "gemini": {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
            }),
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return {
          response_text:
            data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
          model_version: "gemini-2.0-flash",
        };
      }

      case "claude": {
        const response = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1000,
              messages: [{ role: "user", content: promptText }],
            }),
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        if (!data.content || !data.content[0]) throw new Error("Empty response from Claude");
        return {
          response_text: data.content[0].text,
          model_version: data.model || "claude-sonnet-4-20250514",
        };
      }

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchLLMResponses(
  probes: LLMProbe[],
  platforms: string[]
): Promise<LLMResponseResult[]> {
  const results: LLMResponseResult[] = [];
  const responseDate = getTodayDateString();

  for (const probe of probes) {
    for (const platform of platforms) {
      let responseText: string;
      let modelVersion: string;

      try {
        const result = await queryPlatform(platform, probe.prompt_text);
        responseText = result.response_text;
        modelVersion = result.model_version;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message === "MISSING_KEY") {
          console.warn(
            `[llm-fetcher] Skipping ${platform}: API key not configured`
          );
          continue;
        }

        responseText = `[ERROR] ${message}`;
        modelVersion = PLATFORM_CONFIG[platform]?.defaultModel ?? platform;
      }

      // Upsert into llm_responses
      const { data, error } = await supabaseAdmin
        .from("llm_responses")
        .upsert(
          {
            probe_id: probe.id,
            platform,
            response_text: responseText,
            model_version: modelVersion,
            response_date: responseDate,
          },
          { onConflict: "probe_id,platform,response_date" }
        )
        .select("id")
        .single();

      if (error) {
        console.error(
          `[llm-fetcher] Failed to store response for ${platform}/${probe.id}:`,
          error
        );
      }

      results.push({
        probe_id: probe.id,
        platform,
        response_text: responseText,
        model_version: modelVersion,
        stored_id: data?.id ?? null,
      });

      await delay(1000);
    }
  }

  return results;
}
