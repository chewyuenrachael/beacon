/**
 * War Room dashboard types (re-export + channel labels for settings UI).
 */
export type { ResponseTemplate } from "@/lib/types";
import type { TemplateChannel } from "@/lib/types";

export type DraftChannel = TemplateChannel;

export const CHANNEL_CONFIG: Record<
  DraftChannel,
  { emoji: string; label: string }
> = {
  statement: { emoji: "📄", label: "Statement" },
  social: { emoji: "📣", label: "Social" },
  internal: { emoji: "🏢", label: "Internal" },
  press: { emoji: "📰", label: "Press" },
  blog: { emoji: "✍️", label: "Blog" },
};
