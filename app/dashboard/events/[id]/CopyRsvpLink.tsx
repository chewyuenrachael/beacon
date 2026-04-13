"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface CopyRsvpLinkProps {
  path: string;
}

export function CopyRsvpLink({ path }: CopyRsvpLinkProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const absolute =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy}>
      {copied ? "Copied" : "Copy RSVP link"}
    </Button>
  );
}
