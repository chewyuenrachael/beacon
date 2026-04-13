"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { createBrowserClient } from "@supabase/ssr";
import ReactMarkdown from "react-markdown";
import type { MentionRow, FlagType } from "@/lib/types";
import PropagationBadge from "@/components/PropagationBadge";

const AUDIENCE_CONFIG = [
  { slug: "comms", label: "Comms", emoji: "📡" },
  { slug: "product", label: "Product", emoji: "🛠️" },
  { slug: "engineering", label: "Engineering", emoji: "⚙️" },
  { slug: "safety", label: "Safety", emoji: "🛡️" },
  { slug: "policy", label: "Policy", emoji: "🏛️" },
  { slug: "executive", label: "Executive", emoji: "👔" },
];

function sanitizeForMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<img[^>]*>/gi, '[image]')
    .replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
}

function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/&#x2F;/g, '/');
  text = text.replace(/&#x27;/g, "'");
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#\d+;/g, '');
  text = text.replace(/&#x[0-9a-fA-F]+;/g, '');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

const URGENCY_PILL: Record<string, string> = {
  fire: "bg-red-50 text-red-700 border border-red-200",
  moment: "bg-amber-50 text-amber-700 border border-amber-200",
  signal: "bg-blue-50 text-blue-700 border border-blue-200",
  noise: "bg-cream-100 text-ink-500 border border-cream-200",
};

const CARD_STYLES: Record<string, { wrapper: string; padding: string; summary: string }> = {
  fire: {
    wrapper: "border-l-4 border-l-red-400 bg-red-50/30",
    padding: "p-5",
    summary: "font-display text-sm font-medium text-ink-900",
  },
  moment: {
    wrapper: "border-l-4 border-l-amber-400",
    padding: "p-4",
    summary: "font-display text-sm font-medium text-ink-900",
  },
  signal: {
    wrapper: "border-l-2 border-l-blue-300",
    padding: "p-4",
    summary: "text-sm text-ink-700",
  },
  noise: {
    wrapper: "",
    padding: "p-4",
    summary: "text-sm text-ink-500",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  hackernews: "HN",
  reddit: "RD",
  youtube: "YT",
  rss: "RSS",
  manual: "MAN",
  twitter: "\uD835\uDD4F",
  discord: "Discord",
};

function smartTruncate(text: string, maxLen: number = 150): string {
  if (!text || text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > maxLen * 0.6
    ? truncated.substring(0, lastSpace) + '...'
    : truncated + '...';
}

function getTwitterMeta(raw: Record<string, unknown> | null) {
  if (!raw) return null;
  const username = (raw.username as string) || null;
  const accountCategory = (raw.account_category as string) || null;
  const followerCount = (raw.follower_count as number) || 0;
  const isReply = (raw.is_reply as boolean) || false;
  const tweet = raw.tweet as Record<string, unknown> | null;
  const metrics = tweet?.public_metrics as Record<string, number> | null;
  return { username, accountCategory, followerCount, isReply, metrics };
}

function getDiscordMeta(raw: Record<string, unknown> | null) {
  if (!raw) return null;
  const serverName = (raw.server_name as string) || null;
  const channelName = (raw.channel_name as string) || null;
  const reactionCount = (raw.reaction_count as number) || 0;
  const isThread = (raw.is_thread as boolean) || false;
  const hasAttachments = ((raw.attachments as unknown[])?.length || 0) > 0;
  return { serverName, channelName, reactionCount, isThread, hasAttachments };
}

function formatFollowerCount(count: number): string | null {
  if (count < 10_000) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000)}K`;
}

const TENSION_LABELS: Record<string, string> = {
  learning_vs_atrophy: "Learning vs Atrophy",
  time_savings_vs_treadmill: "Time Savings vs Treadmill",
  empowerment_vs_displacement: "Empowerment vs Displacement",
  decision_support_vs_erosion: "Decision vs Erosion",
  productivity_vs_dependency: "Productivity vs Dependency",
};

const FLAG_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft_response: { label: "Response needed", bg: "bg-red-50", text: "text-red-700" },
  share_with_product: { label: "Share with product", bg: "bg-blue-50", text: "text-blue-700" },
  case_study: { label: "Case study", bg: "bg-emerald-50", text: "text-emerald-700" },
  include_in_brief: { label: "Include in brief", bg: "bg-purple-50", text: "text-purple-700" },
};

const TOPIC_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'safety-alignment': { label: 'Safety', bg: 'bg-purple-50', text: 'text-purple-700' },
  'developer-experience': { label: 'Dev experience', bg: 'bg-blue-50', text: 'text-blue-700' },
  'enterprise-adoption': { label: 'Enterprise', bg: 'bg-teal-50', text: 'text-teal-700' },
  'competitive-positioning': { label: 'Competitive', bg: 'bg-amber-50', text: 'text-amber-700' },
  'pricing-access': { label: 'Pricing', bg: 'bg-rose-50', text: 'text-rose-700' },
  'open-source-ecosystem': { label: 'Ecosystem', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'regulation-policy': { label: 'Regulation', bg: 'bg-gray-100', text: 'text-gray-700' },
};

function HopeDots({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Hope: ${score}/3`}>
      <span className="text-[10px] text-ink-300 mr-0.5">H</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < score ? "bg-emerald-500" : "bg-cream-200"
          }`}
        />
      ))}
    </span>
  );
}

function ConcernDots({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Concern: ${score}/3`}>
      <span className="text-[10px] text-ink-300 mr-0.5">C</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < score ? "bg-rose-500" : "bg-cream-200"
          }`}
        />
      ))}
    </span>
  );
}

interface MentionCardProps {
  mention: MentionRow;
  defaultExpanded?: boolean;
  propagation?: { cluster_id: string; cluster_title: string; platforms_reached: string[] } | null;
  onPropagationClick?: (clusterId: string) => void;
}

export default function MentionCard({ mention, defaultExpanded = false, propagation, onPropagationClick }: MentionCardProps) {
  const isNoise = mention.urgency === "noise";
  const [expanded, setExpanded] = useState(isNoise ? false : defaultExpanded);
  const [reviewed, setReviewed] = useState(mention.is_reviewed);
  const [notes, setNotes] = useState(mention.notes || "");
  const [saving, setSaving] = useState(false);
  const [bookmarked, setBookmarked] = useState(mention.is_bookmarked);
  const [flagType, setFlagType] = useState<FlagType | null>(mention.flag_type);
  const [flagDropdownOpen, setFlagDropdownOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [audienceRoutes, setAudienceRoutes] = useState<Record<string, "auto" | "manual">>({});
  const [routesLoaded, setRoutesLoaded] = useState(false);

  useEffect(() => {
    if (!expanded) setFlagDropdownOpen(false);
  }, [expanded]);

  // Lazy-load audience routes when dropdown opens
  useEffect(() => {
    if (!flagDropdownOpen || routesLoaded) return;
    async function loadRoutes() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await supabase
          .from("mention_audience_routes")
          .select("audience_slug, routed_by")
          .eq("mention_id", mention.id);
        const map: Record<string, "auto" | "manual"> = {};
        for (const r of data || []) {
          map[r.audience_slug] = r.routed_by as "auto" | "manual";
        }
        setAudienceRoutes(map);
      } catch {
        // non-critical
      }
      setRoutesLoaded(true);
    }
    loadRoutes();
  }, [flagDropdownOpen, routesLoaded, mention.id]);

  const hasTension = mention.tension_type && mention.tension_type !== "none";
  const urgency = mention.urgency || "noise";
  const style = CARD_STYLES[urgency] || CARD_STYLES.noise;

  async function handleReview() {
    setSaving(true);
    try {
      await fetch(`/api/mentions/${mention.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_reviewed: true }),
      });
      setReviewed(true);
    } catch {
      // silently fail
    }
    setSaving(false);
  }

  async function handleSaveNotes() {
    setSaving(true);
    try {
      await fetch(`/api/mentions/${mention.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
    } catch {
      // silently fail
    }
    setSaving(false);
  }

  async function toggleBookmark(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const res = await fetch(`/api/mentions/${mention.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_bookmarked: next }),
      });
      if (!res.ok) {
        console.error("Bookmark failed:", await res.text());
        setBookmarked(!next);
        return;
      }
      setToast(next ? "Saved to bookmarks" : "Removed from bookmarks");
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error("Bookmark error:", err);
      setBookmarked(!next);
    }
  }

  async function handleSetFlag(flag: FlagType | null) {
    const prev = flagType;
    setFlagType(flag);
    setFlagDropdownOpen(false);
    try {
      const res = await fetch(`/api/mentions/${mention.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag_type: flag }),
      });
      if (!res.ok) {
        console.error("Flag update failed:", await res.text());
        setFlagType(prev);
      }
    } catch (err) {
      console.error("Flag update error:", err);
      setFlagType(prev);
    }
  }

  async function handleToggleAudience(slug: string) {
    const isRouted = slug in audienceRoutes;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    if (isRouted && audienceRoutes[slug] === "manual") {
      // Remove manual route
      const prev = { ...audienceRoutes };
      setAudienceRoutes((r) => {
        const next = { ...r };
        delete next[slug];
        return next;
      });
      try {
        const { error } = await supabase
          .from("mention_audience_routes")
          .delete()
          .eq("mention_id", mention.id)
          .eq("audience_slug", slug)
          .eq("routed_by", "manual");
        if (error) {
          setAudienceRoutes(prev);
        } else {
          const label = AUDIENCE_CONFIG.find((a) => a.slug === slug)?.label || slug;
          setToast(`Removed from ${label}`);
          setTimeout(() => setToast(null), 2000);
        }
      } catch {
        setAudienceRoutes(prev);
      }
    } else if (!isRouted) {
      // Add manual route
      const prev = { ...audienceRoutes };
      setAudienceRoutes((r) => ({ ...r, [slug]: "manual" }));
      try {
        const { error } = await supabase
          .from("mention_audience_routes")
          .upsert(
            { mention_id: mention.id, audience_slug: slug, routed_by: "manual" },
            { onConflict: "mention_id,audience_slug" }
          );
        if (error) {
          setAudienceRoutes(prev);
        } else {
          const label = AUDIENCE_CONFIG.find((a) => a.slug === slug)?.label || slug;
          setToast(`Routed to ${label}`);
          setTimeout(() => setToast(null), 2000);
        }
      } catch {
        setAudienceRoutes(prev);
      }
    }
    // Auto routes cannot be removed from the UI
  }

  return (
    <div
      className={`bg-white border border-cream-200 rounded-lg transition-all cursor-pointer ${
        style.wrapper
      } ${hasTension ? "border-l-4 border-l-purple-400 bg-purple-50/20" : ""} ${
        reviewed ? "opacity-60" : ""
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className={style.padding}>
        {/* Row 1: urgency pill + source + velocity + time */}
        <div className="flex items-center gap-2 mb-1.5">
          {mention.urgency && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                URGENCY_PILL[mention.urgency] || URGENCY_PILL.noise
              }`}
            >
              {mention.urgency}
            </span>
          )}
          {mention.source === "twitter" ? (() => {
            const meta = getTwitterMeta(mention.raw_json);
            return (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-black text-white font-mono">
                <span>{"\uD835\uDD4F"}</span>
                {meta?.username && <span>@{meta.username}</span>}
                {meta?.accountCategory && (
                  <span className="opacity-70">{"\u00B7"} {meta.accountCategory}</span>
                )}
                {meta?.followerCount && formatFollowerCount(meta.followerCount) && (
                  <span className="opacity-70">{"\u00B7"} {formatFollowerCount(meta.followerCount)} followers</span>
                )}
              </span>
            );
          })() : mention.source === "discord" ? (() => {
            const meta = getDiscordMeta(mention.raw_json);
            return (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#5865F2] text-white font-mono">
                <span>Discord</span>
                {meta?.serverName && (
                  <span className="opacity-70">{"\u00B7"} {meta.serverName}{meta.channelName ? `/#${meta.channelName}` : ""}</span>
                )}
              </span>
            );
          })() : (
            <span className="text-[10px] text-ink-300 font-mono uppercase">
              {mention.source === "rss" && mention.author
                ? mention.author
                : SOURCE_LABELS[mention.source] || mention.source}
            </span>
          )}
          {mention.velocity_status === "accelerating" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-orange-600">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-beacon-dot" />
              {Math.round(mention.velocity_score)} pts/hr
            </span>
          )}
          <button
            onClick={toggleBookmark}
            className="ml-auto p-0.5 -m-0.5 transition-colors"
            title={bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            <svg
              className={`w-4 h-4 cursor-pointer transition-colors ${
                bookmarked
                  ? "fill-amber-400 text-amber-400"
                  : "fill-none text-ink-300 hover:text-ink-500"
              }`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
          <span className="text-[10px] text-ink-300">
            {formatDistanceToNow(new Date(mention.published_at), { addSuffix: true })}
          </span>
        </div>

        {/* Row 2: summary */}
        {isNoise && !expanded ? (
          <p
            className="text-xs text-ink-500 line-clamp-2 leading-snug"
            title={mention.summary || mention.title || "Untitled"}
          >
            {smartTruncate(mention.summary || mention.title || "Untitled", 150)}
          </p>
        ) : (
          <p
            className={`${style.summary} line-clamp-2 leading-snug mb-1.5`}
            title={mention.summary || mention.title || "Untitled"}
          >
            {smartTruncate(mention.summary || mention.title || "Untitled", 150)}
          </p>
        )}

        {/* Propagation badge */}
        {propagation && (!isNoise || expanded) && (
          <div className="mb-1.5">
            <PropagationBadge
              propagation={propagation}
              onClick={() => onPropagationClick?.(propagation.cluster_id)}
            />
          </div>
        )}

        {/* Row 3: stats — engagement + hope/concern + emotion + tension (hidden for collapsed noise) */}
        {(!isNoise || expanded) && (
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="text-[10px] text-ink-300">
              {mention.engagement_score} pts
            </span>
            {mention.source === "twitter" && (() => {
              const meta = getTwitterMeta(mention.raw_json);
              if (!meta?.metrics) return null;
              const parts: string[] = [];
              if (meta.metrics.like_count > 0) parts.push(`\u2665 ${meta.metrics.like_count}`);
              if (meta.metrics.retweet_count > 0) parts.push(`\uD83D\uDD01 ${meta.metrics.retweet_count}`);
              if (meta.metrics.reply_count > 0) parts.push(`\uD83D\uDCAC ${meta.metrics.reply_count}`);
              if (parts.length === 0) return null;
              return <span className="text-[10px] text-ink-300">{parts.join(" \u00B7 ")}</span>;
            })()}
            {mention.source === "twitter" && getTwitterMeta(mention.raw_json)?.isReply && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">
                {"\u21A9"} Reply
              </span>
            )}
            {mention.source === "discord" && (() => {
              const meta = getDiscordMeta(mention.raw_json);
              if (!meta) return null;
              return (
                <>
                  {meta.reactionCount > 0 && (
                    <span className="text-[10px] text-ink-300">
                      {"\uD83D\uDC4D"} {meta.reactionCount} reactions
                    </span>
                  )}
                  {meta.isThread && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[#5865F2]/10 text-[#5865F2]">
                      {"\uD83E\uDDF5"} Thread
                    </span>
                  )}
                  {meta.hasAttachments && (
                    <span className="text-[10px] text-ink-300">{"\uD83D\uDCCE"}</span>
                  )}
                </>
              );
            })()}
            <HopeDots score={mention.hope_score} />
            <ConcernDots score={mention.concern_score} />
            {mention.primary_emotion && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-cream-100 text-ink-500 border border-cream-200">
                {mention.primary_emotion}
              </span>
            )}
            {mention.topics?.map(t => TOPIC_CONFIG[t] && (
              <span key={t} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${TOPIC_CONFIG[t].bg} ${TOPIC_CONFIG[t].text}`}>
                {TOPIC_CONFIG[t].label}
              </span>
            ))}
            {hasTension && mention.tension_type && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 border border-purple-200">
                {TENSION_LABELS[mention.tension_type] || mention.tension_type}
              </span>
            )}
            {flagType && FLAG_LABELS[flagType] && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${FLAG_LABELS[flagType].bg} ${FLAG_LABELS[flagType].text}`}>
                {FLAG_LABELS[flagType].label}
              </span>
            )}
          </div>
        )}

        {/* Row 4: recommended action */}
        {mention.recommended_action && (!isNoise || expanded) && (
          <p className="text-xs text-ink-300 italic">
            {mention.recommended_action}
          </p>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div
          className="border-t border-cream-200 p-4 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          {mention.body && (
            <div className="text-sm text-ink-700 leading-relaxed border-t border-cream-200 pt-3 mt-1
              [&_p]:mb-3 [&_p:last-child]:mb-0
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1
              [&_li]:text-sm
              [&_code]:bg-cream-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-ink-600
              [&_pre]:bg-cream-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_pre]:text-xs
              [&_blockquote]:border-l-2 [&_blockquote]:border-cream-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-ink-500
              [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2
              [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
              [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1
              [&_a]:text-accent-terracotta [&_a:hover]:underline
              [&_hr]:border-cream-200 [&_hr]:my-3
              [&_strong]:font-semibold [&_strong]:text-ink-800">
              <ReactMarkdown>{sanitizeForMarkdown(mention.body || '')}</ReactMarkdown>
            </div>
          )}
          <div className="flex items-center gap-3">
            <a
              href={mention.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-terracotta hover:underline"
            >
              View source
            </a>
            {!reviewed && (
              <button
                onClick={handleReview}
                disabled={saving}
                className="text-xs bg-ink-900 text-white px-3 py-1 rounded hover:bg-ink-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Mark reviewed"}
              </button>
            )}
            {reviewed && (
              <span className="text-xs text-emerald-600">Reviewed</span>
            )}
            <div className="relative">
              <button
                onClick={() => setFlagDropdownOpen(!flagDropdownOpen)}
                className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                  flagType && FLAG_LABELS[flagType]
                    ? `${FLAG_LABELS[flagType].bg} ${FLAG_LABELS[flagType].text}`
                    : "border-cream-200 text-ink-500 hover:border-cream-300 hover:bg-cream-50"
                }`}
              >
                {flagType && FLAG_LABELS[flagType] ? FLAG_LABELS[flagType].label : "Flag as..."}
              </button>
              {flagDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-cream-200 rounded-lg shadow-sm py-1 z-10">
                  {/* Section 1: Workflow flags */}
                  {(["draft_response", "case_study", "include_in_brief"] as FlagType[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => handleSetFlag(key)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-cream-50 transition-colors ${
                        flagType === key ? "font-medium text-ink-900" : "text-ink-700"
                      }`}
                    >
                      {FLAG_LABELS[key].label}
                    </button>
                  ))}
                  {flagType && (
                    <button
                      onClick={() => handleSetFlag(null)}
                      className="w-full text-left px-3 py-1.5 text-xs text-ink-300 hover:bg-cream-50 transition-colors"
                    >
                      Clear flag
                    </button>
                  )}

                  {/* Section 2: Route to team */}
                  <div className="border-t border-cream-200 mt-1 pt-1">
                    <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-ink-300">
                      Route to team
                    </p>
                    {AUDIENCE_CONFIG.map((aud) => {
                      const isComms = aud.slug === "comms";
                      const isRouted = aud.slug in audienceRoutes;
                      const routeType = audienceRoutes[aud.slug];
                      const isAuto = routeType === "auto";
                      const checked = isComms || isRouted;

                      return (
                        <button
                          key={aud.slug}
                          onClick={() => !isComms && handleToggleAudience(aud.slug)}
                          disabled={isComms || (isRouted && isAuto)}
                          className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                            isComms || (isRouted && isAuto)
                              ? "text-ink-300 cursor-default"
                              : "text-ink-700 hover:bg-cream-50"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                            checked
                              ? "bg-ink-900 border-ink-900 text-white"
                              : "border-cream-300"
                          }`}>
                            {checked && "✓"}
                          </span>
                          <span>{aud.emoji}</span>
                          <span>{aud.label}</span>
                          {isRouted && isAuto && (
                            <span className="text-[10px] bg-cream-100 text-ink-400 px-1 rounded ml-auto">
                              auto
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add notes..."
              rows={2}
              className="w-full text-sm border border-cream-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-transparent resize-none"
            />
          </div>
        </div>
      )}

      {/* Bookmark toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
