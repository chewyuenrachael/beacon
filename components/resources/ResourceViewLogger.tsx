"use client";

import { useEffect, useRef } from "react";

interface ResourceViewLoggerProps {
  slug: string;
  viewerId?: string;
}

/**
 * Fire-and-forget view logging: initial POST does not block paint;
 * dwell time sent via sendBeacon on pagehide.
 */
export function ResourceViewLogger({ slug, viewerId }: ResourceViewLoggerProps) {
  const viewIdRef = useRef<string | null>(null);
  const startedRef = useRef<number | null>(null);
  const dwellSentRef = useRef(false);

  useEffect(() => {
    dwellSentRef.current = false;
    startedRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const body = JSON.stringify({
      viewer_id: viewerId,
    });
    void fetch(`/api/resources/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as { id?: string };
        if (j.id) viewIdRef.current = j.id;
      })
      .catch(() => {
        /* non-critical */
      });

    const sendDwell = () => {
      if (dwellSentRef.current) return;
      const id = viewIdRef.current;
      const start = startedRef.current;
      if (!id || start == null) return;
      dwellSentRef.current = true;
      const end =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const seconds = Math.max(
        0,
        Math.floor(Math.abs(end - start) / 1000)
      );
      const payload = JSON.stringify({
        view_id: id,
        time_on_page_seconds: seconds,
      });
      const url = `/api/resources/${encodeURIComponent(slug)}/view`;
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", sendDwell);
    return () => {
      window.removeEventListener("pagehide", sendDwell);
      sendDwell();
    };
  }, [slug, viewerId]);

  return null;
}
