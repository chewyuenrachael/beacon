import type { EventType } from "@/lib/types/event";

export interface PlaybookStep {
  id: string;
  label: string;
  description?: string;
}

const playbooks: Record<EventType, PlaybookStep[]> = {
  cafe_cursor: [
    {
      id: "venue",
      label: "Confirm venue and capacity",
      description: "Book room or cafe; note AV and seating.",
    },
    {
      id: "inventory",
      label: "Order swag and signage",
      description: "Cursor stickers, one-pagers, QR to RSVP link.",
    },
    {
      id: "promote",
      label: "Share tracking link",
      description: "Ambassador posts + department channels.",
    },
    {
      id: "run",
      label: "Run check-in",
      description: "Capture emails via RSVP or on-site list.",
    },
    {
      id: "follow_up",
      label: "Follow up within 48h",
      description: "Thank-you + discount / next steps.",
    },
  ],
  hackathon_sponsorship: [
    {
      id: "contract",
      label: "Confirm sponsorship tier",
      description: "Logo, booth, judging, prize budget.",
    },
    {
      id: "booth",
      label: "Plan booth staffing",
      description: "Schedule ambassador + lead coverage.",
    },
    {
      id: "judging",
      label: "Judging rubric and prizes",
      description: "Align with org on criteria and announcements.",
    },
    {
      id: "capture",
      label: "Lead capture at booth",
      description: "RSVP code + scanner or manual list.",
    },
    {
      id: "retro",
      label: "Post-event retro",
      description: "Attribution vs signups; learnings doc.",
    },
  ],
  workshop: [
    {
      id: "outline",
      label: "Finalize agenda and materials",
      description: "Slides, repos, prerequisites.",
    },
    {
      id: "register",
      label: "Open registration",
      description: "Use public RSVP link with tracking code.",
    },
    {
      id: "dry_run",
      label: "Tech check",
      description: "Screen share, recording consent, backup link.",
    },
    {
      id: "deliver",
      label: "Deliver session",
      description: "Q&A buffer; collect feedback.",
    },
    {
      id: "recording",
      label: "Share recording and resources",
      description: "Email attendees within one week.",
    },
  ],
  lab_demo: [
    {
      id: "pi_alignment",
      label: "Confirm PI / lab interest",
      description: "Research fit and audience (grads, UGs).",
    },
    {
      id: "demo_script",
      label: "Prepare demo script",
      description: "Short, reproducible, on their stack if possible.",
    },
    {
      id: "logistics",
      label: "Room and machine access",
      description: "VPN, GPU, install permissions.",
    },
    {
      id: "attendees",
      label: "Capture attendee emails",
      description: "RSVP or sign-in sheet.",
    },
    {
      id: "next_steps",
      label: "Document next steps",
      description: "Licenses, follow-on workshops, papers.",
    },
  ],
  professor_talk: [
    {
      id: "abstract",
      label: "Confirm title and abstract",
      description: "For calendar and department mail.",
    },
    {
      id: "host",
      label: "Coordinate with host department",
      description: "Intro, timing, recording policy.",
    },
    {
      id: "promote_talk",
      label: "Promote talk",
      description: "Newsletter, Slack, RSVP link.",
    },
    {
      id: "day_of",
      label: "Day-of logistics",
      description: "Mic, slides, livestream link if any.",
    },
    {
      id: "office_hours",
      label: "Optional office hours",
      description: "Small-group follow-up for interested students.",
    },
  ],
};

export function getPlaybookForEventType(type: EventType): PlaybookStep[] {
  return playbooks[type];
}

export function listEventTypesWithPlaybooks(): EventType[] {
  return Object.keys(playbooks) as EventType[];
}
