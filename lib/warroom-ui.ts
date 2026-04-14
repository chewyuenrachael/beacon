/**
 * War Room / incident UI helpers (moved out of app router so Pulse-era
 * dashboard stubs can be removed).
 */
import type {
  Incident as BaseIncident,
  IncidentSeverity,
  IncidentStatus,
  ReviewerRole,
} from "@/lib/types";

export type {
  ResponseTemplate,
  ResponseDraft,
  DraftComment,
  DraftStatus,
  PostIncidentReview,
  StakeholderChecklistItem,
} from "@/lib/types";

export type Incident = BaseIncident & {
  velocity_status?: string;
  latest_draft_status?: string;
};

export type StakeholderRole = ReviewerRole;

export type ActionItem = {
  id: string;
  action: string;
  owner: string;
  deadline: string | null;
  status: string;
};

export interface TimelineEntry {
  id: string;
  type: string;
  time: string;
  data?: Record<string, unknown>;
}

export const CHANNEL_CONFIG: Record<
  import("@/lib/types").TemplateChannel,
  { emoji: string; label: string }
> = {
  statement: { emoji: "📄", label: "Statement" },
  social: { emoji: "📣", label: "Social" },
  internal: { emoji: "🏢", label: "Internal" },
  press: { emoji: "📰", label: "Press" },
  blog: { emoji: "✍️", label: "Blog" },
};

export type DraftChannel = import("@/lib/types").TemplateChannel;

export const SEVERITY_CONFIG: Record<
  IncidentSeverity,
  { emoji: string; label: string; border: string; bg: string; text: string }
> = {
  critical: {
    emoji: "🔴",
    label: "Critical",
    border: "border-red-600",
    bg: "bg-red-50",
    text: "text-red-800",
  },
  high: {
    emoji: "🟠",
    label: "High",
    border: "border-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-800",
  },
  medium: {
    emoji: "🟡",
    label: "Medium",
    border: "border-amber-400",
    bg: "bg-amber-50",
    text: "text-amber-800",
  },
  low: {
    emoji: "🟢",
    label: "Low",
    border: "border-emerald-400",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
  },
};

export const STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; bg: string; text: string }
> = {
  active: { label: "Active", bg: "bg-red-50", text: "text-red-700" },
  monitoring: { label: "Monitoring", bg: "bg-amber-50", text: "text-amber-700" },
  resolved: { label: "Resolved", bg: "bg-emerald-50", text: "text-emerald-700" },
  "post-mortem": { label: "Post-mortem", bg: "bg-cream-100", text: "text-ink-600" },
};

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export const ROLE_CONFIG: Record<
  StakeholderRole,
  { emoji: string; label: string }
> = {
  comms: { emoji: "📣", label: "Comms" },
  legal: { emoji: "⚖️", label: "Legal" },
  executive: { emoji: "👔", label: "Executive" },
  engineering: { emoji: "🛠️", label: "Engineering" },
  policy: { emoji: "📋", label: "Policy" },
};

export const TIMELINE_ICONS: Record<string, { emoji: string; color: string }> = {
  fire_detected: { emoji: "🔥", color: "bg-red-400" },
  mention: { emoji: "💬", color: "bg-amber-400" },
  draft_created: { emoji: "✍️", color: "bg-blue-400" },
  draft_approved: { emoji: "✅", color: "bg-emerald-400" },
  stakeholder_notified: { emoji: "📬", color: "bg-violet-400" },
  comment_added: { emoji: "💭", color: "bg-slate-400" },
  mention_linked: { emoji: "🔗", color: "bg-teal-400" },
  incident_resolved: { emoji: "🏁", color: "bg-emerald-500" },
  status_changed: { emoji: "🔄", color: "bg-ink-400" },
  severity_changed: { emoji: "⚡", color: "bg-orange-400" },
};

export async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function safeFetchArray<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const data = Array.isArray(json) ? json : json.data;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}
