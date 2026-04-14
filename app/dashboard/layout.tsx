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
        <p className="text-ink-300 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[200px] shrink-0 border-r border-cream-200 bg-white flex flex-col">
        <div className="px-4 py-5">
          <Link
            href="/dashboard"
            className="font-display text-lg font-semibold tracking-tight text-ink-900"
          >
            Beacon
          </Link>
        </div>
        <nav className="flex-1 px-2 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
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
                          ? "bg-cream-100 text-ink-900 font-medium"
                          : "text-ink-500 hover:text-ink-700 hover:bg-cream-50"
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
