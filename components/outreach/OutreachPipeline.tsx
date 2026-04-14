"use client";

import { useMemo, useState } from "react";
import type { OutreachTouchpoint } from "@/lib/types/outreach";
import { isProfessorLinkedTargetType } from "@/lib/types/outreach";
import { OutreachCard } from "./OutreachCard";

const STAGES: OutreachTouchpoint["stage"][] = [
  "cold",
  "contacted",
  "meeting_booked",
  "demo_held",
  "partnership_active",
  "dead",
];

export type EnrichedTouchpoint = {
  touchpoint: OutreachTouchpoint;
  institutionId?: string;
  institutionName?: string;
};

export function OutreachPipeline(props: {
  rows: EnrichedTouchpoint[];
  institutionOptions: { id: string; name: string }[];
}) {
  const { rows, institutionOptions } = props;
  const [targetType, setTargetType] = useState<string>("");
  const [institutionId, setInstitutionId] = useState<string>("");
  const [channel, setChannel] = useState<string>("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (targetType && r.touchpoint.target_type !== targetType) return false;
      if (channel && r.touchpoint.channel !== channel) return false;
      if (institutionId) {
        if (isProfessorLinkedTargetType(r.touchpoint.target_type)) {
          return r.institutionId === institutionId;
        }
        return true;
      }
      return true;
    });
  }, [rows, targetType, institutionId, channel]);

  const byStage = useMemo(() => {
    const m = new Map<string, EnrichedTouchpoint[]>();
    for (const s of STAGES) m.set(s, []);
    for (const r of filtered) {
      const list = m.get(r.touchpoint.stage) ?? [];
      list.push(r);
      m.set(r.touchpoint.stage, list);
    }
    return m;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-ink-500 mb-1">Target type</label>
          <select
            className="text-sm border border-cream-200 rounded-md px-2 py-1.5 bg-white"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
          >
            <option value="">All</option>
            <option value="professor">Professor</option>
            <option value="student_org">Student org</option>
            <option value="ta">TA</option>
            <option value="department_chair">Department chair</option>
            <option value="hackathon_organizer">Hackathon organizer</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-500 mb-1">Institution</label>
          <select
            className="text-sm border border-cream-200 rounded-md px-2 py-1.5 bg-white"
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
          >
            <option value="">All</option>
            {institutionOptions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-500 mb-1">Channel</label>
          <select
            className="text-sm border border-cream-200 rounded-md px-2 py-1.5 bg-white"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="">All</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="event">Event</option>
          </select>
        </div>
      </div>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${STAGES.length}, minmax(180px, 1fr))`,
        }}
      >
        {STAGES.map((stage) => (
          <div key={stage} className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">
              {stage.replace(/_/g, " ")}
            </h3>
            <div className="space-y-2 min-h-[120px]">
              {(byStage.get(stage) ?? []).map((r) => (
                <OutreachCard
                  key={r.touchpoint.id}
                  touchpoint={r.touchpoint}
                  institutionLabel={r.institutionName}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
