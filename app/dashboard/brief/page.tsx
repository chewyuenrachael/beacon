"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { format } from "date-fns";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CopyBriefButton from "@/components/CopyBriefButton";
import FiresTable from "@/components/FiresTable";
import AudienceSelector from "@/components/AudienceSelector";
import type { DailyBriefRow, Audience, AudienceBrief } from "@/lib/types";

const TOPIC_LABELS: Record<string, string> = {
  "safety-alignment": "Safety",
  "developer-experience": "Dev experience",
  "enterprise-adoption": "Enterprise",
  "competitive-positioning": "Competitive",
  "pricing-access": "Pricing",
  "open-source-ecosystem": "Ecosystem",
  "regulation-policy": "Regulation",
};

interface FireMention {
  id: string;
  summary: string | null;
  title: string | null;
  recommended_action: string | null;
  source: string;
  source_url: string;
  engagement_score: number | null;
}

function getGreeting(fires: number, moments: number, tensions: number): string {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (fires >= 3) return `Heads up, Rach \u2014 ${fires} things need attention`;
  if (fires > 0) return `${timeGreeting}, Rach \u2014 a few fires to check`;
  if (moments >= 5) return `Good stuff happening today, Rach`;
  if (tensions > 0) return `Interesting tensions today, Rach`;
  return `Smooth sailing today, Rach`;
}

function BriefPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedAudience = searchParams.get("audience") || "comms";

  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [date, setDate] = useState("");
  const [brief, setBrief] = useState<DailyBriefRow | null>(null);
  const [audienceBrief, setAudienceBrief] = useState<AudienceBrief | null>(null);
  const [fires, setFires] = useState<FireMention[]>([]);
  const [stats, setStats] = useState<{ mentions: number; fires: number; tensions: number; moments: number; topTopics: { theme: string; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Dynamic page title
  useEffect(() => {
    const aud = audiences.find((a) => a.slug === selectedAudience);
    document.title = aud && aud.slug !== "comms"
      ? `${aud.display_name} Brief — Beacon`
      : "Briefs — Beacon";
  }, [selectedAudience, audiences]);

  // Fetch audiences
  useEffect(() => {
    async function fetchAudiences() {
      try {
        const res = await fetch("/api/audiences");
        if (res.ok) {
          const data = await res.json();
          setAudiences((data || []).filter((a: Audience) => a.is_active));
        }
      } catch {
        // non-critical
      }
    }
    fetchAudiences();
  }, []);

  // On mount: init date for comms brief
  useEffect(() => {
    async function init() {
      const today = format(new Date(), "yyyy-MM-dd");
      const todayRes = await fetch(`/api/brief/${today}`).catch(() => null);
      if (todayRes?.ok) {
        setDate(today);
      } else {
        const latestRes = await fetch("/api/brief/latest").catch(() => null);
        if (latestRes?.ok) {
          const latestBrief = await latestRes.json();
          setDate(latestBrief.brief_date);
        } else {
          setDate(today);
        }
      }
      setInitialized(true);
    }
    init();
  }, []);

  // Fetch comms brief + fires + stats when date changes
  useEffect(() => {
    if (!initialized || selectedAudience !== "comms") return;
    setLoading(true);

    Promise.all([
      fetch(`/api/brief/${date}`).then((res) => (res.ok ? res.json() : null)).catch(() => null),
      fetch(`/api/mentions?urgency=fire&time_range=24h&limit=50`).then((res) => (res.ok ? res.json() : null)).then((json) => (json?.data || json || []) as FireMention[]).catch(() => [] as FireMention[]),
      fetch("/api/brief/stats").then((res) => (res.ok ? res.json() : null)).catch(() => null),
    ]).then(([briefData, firesData, statsData]) => {
      setBrief(briefData);
      setFires(firesData);
      setStats(statsData);
      setLoading(false);
    });
  }, [date ?? "", initialized, selectedAudience]); // date must always be present

  // Fetch audience brief when non-comms selected
  useEffect(() => {
    if (!initialized || selectedAudience === "comms") return;
    setLoading(true);

    const dateParam = date ? `?date=${date}` : '';
    Promise.all([
      fetch(`/api/briefs/audience/${selectedAudience}${dateParam}`).then((res) => (res.ok ? res.json() : null)).catch(() => null),
      fetch("/api/brief/stats").then((res) => (res.ok ? res.json() : null)).catch(() => null),
      fetch(`/api/mentions?urgency=fire&time_range=24h&limit=50`).then((res) => (res.ok ? res.json() : null)).then((json) => (json?.data || json || []) as FireMention[]).catch(() => [] as FireMention[]),
    ]).then(([briefData, statsData, firesData]) => {
      setAudienceBrief(briefData?.error ? null : briefData);
      setStats(statsData);
      setFires(firesData);
      setLoading(false);
    });
  }, [selectedAudience, initialized, date ?? ""]); // date must always be present

  const handleSelectAudience = useCallback((slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === "comms") {
      params.delete("audience");
    } else {
      params.set("audience", slug);
    }
    const qs = params.toString();
    router.replace(`/dashboard/brief${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [searchParams, router]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      if (selectedAudience === "comms") {
        const res = await fetch("/api/brief", { method: "POST" });
        if (res.ok) {
          const [briefRes, statsRes] = await Promise.all([
            fetch(`/api/brief/${date}`),
            fetch("/api/brief/stats"),
          ]);
          if (briefRes.ok) setBrief(await briefRes.json());
          if (statsRes.ok) setStats(await statsRes.json());
        }
      } else {
        const res = await fetch("/api/briefs/audience", { method: "POST" });
        if (res.ok) {
          const briefRes = await fetch(`/api/briefs/audience/${selectedAudience}`);
          if (briefRes.ok) {
            const data = await briefRes.json();
            setAudienceBrief(data?.error ? null : data);
          }
        }
      }
    } catch {
      // silently fail
    } finally {
      setRegenerating(false);
    }
  }

  const currentAudience = audiences.find((a) => a.slug === selectedAudience);
  const isComms = selectedAudience === "comms";
  const activeBriefMarkdown = isComms ? brief?.full_brief : audienceBrief?.full_brief;
  const activeBriefGeneratedAt = isComms ? brief?.generated_at : audienceBrief?.generated_at;
  const hasContent = !!activeBriefMarkdown;

  // Brief parsing
  const { executiveSummary, bodyMarkdown } = useMemo(() => {
    if (!activeBriefMarkdown) return { executiveSummary: null, bodyMarkdown: "" };
    const text = activeBriefMarkdown;
    const firstHeading = text.indexOf("\n##");
    if (firstHeading <= 0) return { executiveSummary: null, bodyMarkdown: text };
    return {
      executiveSummary: text.slice(0, firstHeading).trim(),
      bodyMarkdown: text.slice(firstHeading).trim(),
    };
  }, [activeBriefMarkdown]);

  const summaryBullets = useMemo(() => {
    if (!executiveSummary) return [];
    return executiveSummary
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('\u2022') || line.startsWith('•'))
      .map((line) => line.replace(/^[•\u2022]\s*/, ''));
  }, [executiveSummary]);

  const sections = useMemo(() => {
    if (!bodyMarkdown) return [];
    return bodyMarkdown
      .split(/(?=^## )/m)
      .filter((s) => s.trim())
      .filter((s) => !s.includes("Act now"));
  }, [bodyMarkdown]);

  const greeting = getGreeting(
    stats?.fires ?? fires.length,
    stats?.moments ?? 0,
    stats?.tensions ?? 0
  );

  return (
    <div className="max-w-2xl mx-auto pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">{greeting}</h1>
          <p className="text-sm text-ink-300 mt-0.5">
            {date ? format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy") : "\u00A0"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-xs border border-cream-200 rounded-md px-2.5 py-1 hover:bg-cream-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regenerating ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </span>
            ) : (
              "Regenerate"
            )}
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs border border-cream-200 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-transparent"
          />
        </div>
      </div>

      {/* Audience selector */}
      {audiences.length > 0 && (
        <div className="mt-4">
          <AudienceSelector
            audiences={audiences}
            selectedSlug={selectedAudience}
            onSelect={handleSelectAudience}
          />
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-cream-200 rounded-lg p-3 animate-beacon">
                <div className="h-3 w-12 bg-cream-100 rounded mb-2" />
                <div className="h-6 w-8 bg-cream-50 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white border border-cream-200 rounded-lg p-6 animate-beacon">
            <div className="h-4 w-1/3 bg-cream-100 rounded mb-3" />
            <div className="h-4 w-full bg-cream-50 rounded mb-2" />
            <div className="h-4 w-2/3 bg-cream-50 rounded" />
          </div>
        </div>
      ) : !hasContent ? (
        <div className="mt-8 bg-white border border-cream-200 rounded-xl p-12 text-center">
          <p className="text-sm text-ink-300">
            No brief generated for {isComms ? "this date" : currentAudience?.display_name || "this audience"} yet.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Stats row */}
          <div className="mt-6 grid grid-cols-4 gap-2">
            <Link href="/dashboard">
              <StatCard label="MENTIONS" value={stats?.mentions ?? 0} />
            </Link>
            <Link href="/dashboard?urgency=fire">
              <StatCard label="FIRES" value={stats?.fires ?? 0} color="text-red-600" />
            </Link>
            <Link href="/dashboard/tensions">
              <StatCard label="TENSIONS" value={stats?.tensions ?? 0} color="text-purple-600" />
            </Link>
            <Link href="/dashboard?urgency=moment">
              <StatCard label="MOMENTS" value={stats?.moments ?? 0} color="text-amber-600" />
            </Link>
          </div>

          {/* 1b. Top narratives breakdown */}
          {stats?.topTopics && stats.topTopics.length > 0 && (() => {
            const TOPIC_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
              'developer-experience': { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-400' },
              'open-source-ecosystem': { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-400' },
              'pricing-access': { bg: 'bg-rose-50', text: 'text-rose-700', bar: 'bg-rose-400' },
              'competitive-positioning': { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-400' },
              'safety-alignment': { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-400' },
              'enterprise-adoption': { bg: 'bg-teal-50', text: 'text-teal-700', bar: 'bg-teal-400' },
              'regulation-policy': { bg: 'bg-gray-100', text: 'text-gray-700', bar: 'bg-gray-400' },
            };
            const visible = stats.topTopics.slice(0, 5);
            const hiddenCount = stats.topTopics.length - visible.length;
            const total = stats.topTopics.reduce((sum, t) => sum + t.count, 0);

            return (
              <div className="bg-white border border-cream-200 rounded-xl p-5 mt-3">
                <p className="text-xs text-ink-400 uppercase tracking-wider mb-3">
                  Today&apos;s narrative breakdown
                </p>
                <div className="flex flex-wrap gap-3">
                  {visible.map(({ theme, count }) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const c = TOPIC_COLORS[theme] || { bg: 'bg-cream-100', text: 'text-ink-700', bar: 'bg-ink-300' };
                    const label = TOPIC_LABELS[theme] || theme;

                    return (
                      <div key={theme} className="flex-1 min-w-[120px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${c.text}`}>
                            {label}
                          </span>
                          <span className="text-xs text-ink-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-cream-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hiddenCount > 0 && (
                  <p className="text-xs text-ink-300 mt-2">and {hiddenCount} more</p>
                )}
              </div>
            );
          })()}

          {/* 2. Executive Summary */}
          {summaryBullets.length > 0 ? (
            <div className="mt-6 bg-white border border-cream-200 rounded-xl border-l-4 border-l-ink-900 py-6 px-6">
              <div className="font-serif space-y-3">
                {summaryBullets.map((bullet, i) => {
                  const dotColor = i === 0 && (stats?.fires ?? 0) > 0
                    ? 'text-red-500'
                    : 'text-ink-300';
                  return (
                    <p key={i} className="text-base leading-relaxed text-ink-900">
                      <span className={`${dotColor} mr-2`}>&bull;</span>
                      {bullet}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : executiveSummary ? (
            <div className="mt-6 bg-white border border-cream-200 rounded-xl border-l-4 border-l-ink-900 py-6 px-6">
              <div className="font-serif">
                <ReactMarkdown remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="text-base font-medium text-ink-900 leading-relaxed">{children}</p>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-terracotta hover:underline">
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  }}
                >
                  {executiveSummary}
                </ReactMarkdown>
              </div>
            </div>
          ) : null}

          {/* 3. Fires table — comms only */}
          {isComms && (
          <div className="mt-6 bg-white border border-cream-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2">
                <span>🔥</span> Act now
              </h2>
              <Link href="/dashboard?urgency=fire" className="text-xs text-ink-300 hover:text-ink-500">
                View all &rarr;
              </Link>
            </div>
            <FiresTable fires={fires} />
          </div>
          )}

          {/* 4. Brief sections */}
          <div className="mt-6 space-y-4">
            {sections.map((section, i) => (
              <div
                key={i}
                className="bg-white border border-cream-200 rounded-xl px-6 py-5"
              >
                <div className="font-serif">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-terracotta hover:underline">
                          {children}
                        </a>
                      ),
                      h2: ({ children }) => {
                        const text = String(children);
                        let navHref = "/dashboard";
                        if (text.includes("attention")) navHref = "/dashboard?urgency=moment";
                        else if (text.includes("radar")) navHref = "/dashboard?urgency=signal";

                        return (
                          <div className="flex items-center justify-between mb-3">
                            <h2 className="font-display text-base font-semibold text-ink-900">{children}</h2>
                            {navHref !== "/dashboard" && (
                              <a href={navHref} className="text-xs text-ink-300 hover:text-ink-500 font-sans">
                                View all &rarr;
                              </a>
                            )}
                          </div>
                        );
                      },
                      li: ({ children }) => (
                        <li className="mb-2.5 leading-relaxed text-sm text-ink-700">{children}</li>
                      ),
                      table: ({ children }) => (
                        <table className="w-full border-collapse mt-2 mb-4">{children}</table>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-cream-50">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="text-left text-xs font-semibold text-ink-400 uppercase tracking-wider px-4 py-3 border-b border-cream-200">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="px-4 py-3 text-sm text-ink-800 border-b border-cream-100 align-top leading-relaxed">{children}</td>
                      ),
                      tr: ({ children }) => (
                        <tr className="hover:bg-cream-50/50">{children}</tr>
                      ),
                      strong: ({ children }) => {
                        const text = String(children);
                        const typeMatch = text.match(/\((moment|signal|competitor|tension|accelerating)\)$/);
                        const cleanText = text.replace(/\s*\((moment|signal|competitor|tension|accelerating)\)$/, '');
                        const type = typeMatch ? typeMatch[1] : null;

                        const dotColors: Record<string, string> = {
                          moment: 'bg-amber-400',
                          signal: 'bg-blue-400',
                          competitor: 'bg-violet-400',
                          tension: 'bg-purple-400',
                          accelerating: 'bg-orange-400',
                        };
                        const dotColor = type ? dotColors[type] || 'bg-ink-300' : null;

                        return (
                          <span className="flex items-start gap-2 mt-8 mb-0.5 first-of-type:mt-3">
                            {dotColor && (
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-[7px] flex-shrink-0`} />
                            )}
                            <span className="font-semibold text-[15px] text-ink-900">{cleanText}</span>
                          </span>
                        );
                      },
                      p: ({ children }) => {
                        const text = String(children);
                        if (text.startsWith('Action:')) {
                          return (
                            <p className="font-serif text-xs text-ink-500 mt-1 mb-0">
                              {children}
                            </p>
                          );
                        }
                        return (
                          <p className="font-serif text-[14px] leading-snug text-ink-500 mb-0">
                            {children}
                          </p>
                        );
                      },
                    }}
                  >
                    {section}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>

          {/* 5. Timestamp + actions */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-ink-300">
              Generated {activeBriefGeneratedAt ? format(new Date(activeBriefGeneratedAt), "MMM d, yyyy h:mm a") : "—"}
            </span>
            <CopyBriefButton markdown={activeBriefMarkdown!} />
          </div>
        </>
      )}
    </div>
  );
}

export default function BriefPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto pt-4"><div className="h-8 w-48 bg-cream-100 rounded animate-beacon" /></div>}>
      <BriefPageInner />
    </Suspense>
  );
}

function StatCard({
  label,
  value,
  color = "text-ink-900",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white border border-cream-200 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-cream-100 transition-colors">
      <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-0.5">{label}</p>
      <p className={`text-2xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}
