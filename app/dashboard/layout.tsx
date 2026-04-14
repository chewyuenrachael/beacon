"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const NAV_SECTIONS = [
  {
    title: "Strategic",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/workqueue", label: "Workqueue" },
      { href: "/dashboard/professors", label: "Professors" },
      { href: "/dashboard/outreach", label: "Outreach" },
    ],
  },
  {
    title: "Ambassador Ops",
    items: [
      { href: "/dashboard/ambassadors", label: "Ambassadors" },
      { href: "/dashboard/resources", label: "Resources" },
      { href: "/dashboard/resources/analytics", label: "Resource analytics" },
    ],
  },
  {
    title: "Community Ops",
    items: [
      { href: "/dashboard/events", label: "Events" },
      { href: "/dashboard/discount", label: "Discount" },
      { href: "/dashboard/discount/queue", label: "Discount Queue" },
      { href: "/dashboard/discount/geography", label: "Discount Geography" },
    ],
  },
] as const;

function navItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed] = useState(true);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[216px] shrink-0 border-r border-border-subtle bg-surface flex flex-col">
        <div className="px-5 py-5">
          <Link
            href="/dashboard"
            className="font-sans text-lg font-semibold tracking-tight text-text-primary"
          >
            Beacon
          </Link>
        </div>
        <nav className="flex-1 px-3 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="px-3 mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = navItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-surface-raised text-text-primary font-medium"
                          : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border-subtle">
          <button
            onClick={async () => {
              const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
