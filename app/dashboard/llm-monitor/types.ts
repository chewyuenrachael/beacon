/**
 * Dashboard constants for LLM monitor UI (stubs for missing split from lib/types).
 */
export type { LLMProbe, ProbeCategory, LLMPlatform } from "@/lib/types";

import type { ProbeCategory } from "@/lib/types";

export const PROBE_CATEGORIES: ProbeCategory[] = [
  "product-comparison",
  "safety-perception",
  "brand-reputation",
  "technical-capability",
  "pricing",
  "competitor-positioning",
  "factual-accuracy",
];

export const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  copilot: "Copilot",
  "meta-ai": "Meta AI",
  claude: "Claude",
};
