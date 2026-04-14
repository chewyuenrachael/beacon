/**
 * LLM monitor UI constants (moved out of app router so dashboard stubs
 * can be removed).
 */
import type { LLMPlatform, ProbeCategory } from "@/lib/types";

export type {
  LLMProbe,
  ProbeCategory,
  LLMPlatform,
  LLMResponse,
  LLMMonitoringSnapshot,
  LLMPlatformSummary,
} from "@/lib/types";

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

export const PLATFORM_COLORS: Record<LLMPlatform, string> = {
  chatgpt: "#10a37f",
  gemini: "#4285f4",
  perplexity: "#20b8cd",
  copilot: "#0078d4",
  "meta-ai": "#0668E1",
  claude: "#d97757",
};

export type LLMResponseHighlight = {
  type: "positive" | "negative" | "error" | "narrative";
  start: number;
  end: number;
  detail: string;
};

export type LLMFactError = {
  response_id: string;
  claim: string;
  reality: string;
  severity: string;
  platform: string;
  response_date: string;
  is_persistent: boolean;
  probe_prompt?: string;
};
