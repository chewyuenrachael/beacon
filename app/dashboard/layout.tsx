"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const NAV_ITEMS = [
  { href: "/dashboard/warroom", label: "War Room" },
  { href: "/dashboard/brief", label: "Brief" },
  { href: "/dashboard/ambassadors", label: "Ambassadors" },
  { href: "/dashboard", label: "Feed" },
  { href: "/dashboard/tensions", label: "Tensions" },
  { href: "/dashboard/competitors", label: "Competitors" },
  { href: "/dashboard/narratives", label: "Narratives" },
  { href: "/dashboard/prep", label: "Prep" },
  { href: "/dashboard/trends", label: "Trends" },
  { href: "/dashboard/globe", label: "Globe" },
  { href: "/dashboard/llm-monitor", label: "LLM Intelligence" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed] = useState(true);
  const [fireCount, setFireCount] = useState(0);
  const [llmErrorCount, setLlmErrorCount] = useState(0);
  const [activeIncidentCount, setActiveIncidentCount] = useState(0);

  // Fetch active incident count for War Room badge
  useEffect(() => {
    if (!authed) return;
    async function fetchIncidents() {
      try {
        const res = await fetch("/api/incidents?status=active");
        if (!res.ok) return;
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.data || [];
        setActiveIncidentCount(data.length);
      } catch {
        // non-critical
      }
    }
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 60_000);
    return () => clearInterval(interval);
  }, [authed]);

  // Fetch unreviewed fire count for indicator dot
  useEffect(() => {
    if (!authed) return;
    async function fetchFires() {
      try {
        const res = await fetch("/api/mentions?urgency=fire&time_range=24h&limit=100");
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data || json;
        const unreviewed = Array.isArray(data)
          ? data.filter((m: { is_reviewed?: boolean }) => !m.is_reviewed).length
          : 0;
        setFireCount(unreviewed);
      } catch {
        // non-critical
      }
    }
    fetchFires();
    const interval = setInterval(fetchFires, 60_000);
    return () => clearInterval(interval);
  }, [authed]);

  // Fetch LLM critical error count for indicator dot
  useEffect(() => {
    if (!authed) return;
    async function fetchLLMErrors() {
      try {
        const res = await fetch("/api/llm-monitor/responses?has_critical_errors=true&limit=1");
        if (!res.ok) return;
        const json = await res.json();
        setLlmErrorCount(json.count || 0);
      } catch {
        // non-critical
      }
    }
    fetchLLMErrors();
    const interval = setInterval(fetchLLMErrors, 60_000);
    return () => clearInterval(interval);
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-300 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[180px] shrink-0 border-r border-cream-200 bg-white flex flex-col">
        <div className="px-4 py-5 flex items-center gap-1.5">
          <span className="text-accent-terracotta text-lg leading-none">*</span>
          <Link href="/dashboard" className="font-display text-lg font-semibold tracking-tight text-ink-900">
            Beacon
          </Link>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-cream-100 text-ink-900 font-medium"
                    : "text-ink-500 hover:text-ink-700 hover:bg-cream-50"
                }`}
              >
                {item.label === "War Room" ? "🚨 " : ""}{item.label}
                {item.label === "War Room" && activeIncidentCount > 0 && (
                  <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-medium leading-none">
                    {activeIncidentCount}
                  </span>
                )}
                {(item.label === "Brief" || item.label === "Feed") && fireCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
                {item.label === "LLM Intelligence" && llmErrorCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-cream-200">
          <button
            onClick={async () => {
              const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            className="text-xs text-ink-300 hover:text-ink-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-cream-50">
        <div className="px-6 py-4">{children}</div>
      </main>
    </div>
  );
}
