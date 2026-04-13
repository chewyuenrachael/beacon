"use client";

import { useEffect, useState } from "react";
import type { ResponseTemplate, Incident } from "@/app/dashboard/warroom/types";
import { CHANNEL_CONFIG, safeFetchArray } from "@/app/dashboard/warroom/types";

interface TemplateSelectorProps {
  incident: Incident;
  onSelect: (templateBody: string, templateId: string | null, title: string) => void;
  onCancel: () => void;
}

export default function TemplateSelector({ incident, onSelect, onCancel }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await safeFetchArray<ResponseTemplate>("/api/templates");
      setTemplates(data.filter((t) => t.is_active));
      setLoading(false);
    }
    load();
  }, []);

  // Filter by incident type, fallback to all
  const filtered = incident.incident_type
    ? templates.filter((t) => t.scenario_type === incident.incident_type)
    : [];
  const displayTemplates = filtered.length > 0 ? filtered : templates;

  // Group by scenario type
  const grouped: Record<string, ResponseTemplate[]> = {};
  for (const t of displayTemplates) {
    const key = t.scenario_type || "General";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  return (
    <div
      className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-cream-200">
          <h2 className="font-display text-base font-semibold text-ink-900">
            Choose a Template
          </h2>
          <p className="text-xs text-ink-400 mt-0.5">
            {incident.incident_type
              ? `Showing templates for "${incident.incident_type}"`
              : "Showing all templates"}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onSelect("", null, "New Draft")}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 hover:border-gray-300 hover:bg-cream-50 transition-colors text-left"
            >
              <span className="font-medium text-ink-900">Start from scratch</span>
              <span className="block text-xs text-ink-400 mt-0.5">Empty draft</span>
            </button>
            <button
              onClick={() => onSelect("__ai_draft__", null, "AI-Drafted Response")}
              className="flex-1 text-sm border border-accent-terracotta/30 rounded-lg px-3 py-2.5 hover:bg-orange-50 transition-colors text-left"
            >
              <span className="font-medium text-accent-terracotta">Use AI to draft</span>
              <span className="block text-xs text-ink-400 mt-0.5">Claude generates a response</span>
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-beacon bg-cream-100 rounded-lg h-20" />
              ))}
            </div>
          ) : displayTemplates.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-6">
              No templates available. Start from scratch or use AI.
            </p>
          ) : (
            Object.entries(grouped).map(([type, tmpls]) => (
              <div key={type}>
                <h3 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
                  {type}
                </h3>
                <div className="space-y-2">
                  {tmpls.map((t) => {
                    const ch = CHANNEL_CONFIG[t.channel] || { emoji: "📄", label: t.channel };
                    return (
                      <button
                        key={t.id}
                        onClick={() => onSelect(t.template_body, t.id, t.title)}
                        className="w-full text-left border border-cream-200 rounded-lg p-3 hover:border-gray-300 hover:bg-cream-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{t.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-100 text-ink-500 border border-cream-200">
                            {ch.emoji} {ch.label}
                          </span>
                          {t.usage_count > 0 && (
                            <span className="text-[10px] text-ink-300 ml-auto">
                              Used {t.usage_count} times
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-400 mt-1 line-clamp-2">
                          {t.template_body.slice(0, 120)}
                          {t.template_body.length > 120 ? "..." : ""}
                        </p>
                        {t.placeholders.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {t.placeholders.map((p) => (
                              <span
                                key={p}
                                className="text-[10px] px-1 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200"
                              >
                                {`{{${p}}}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-cream-200">
          <button
            onClick={onCancel}
            className="text-sm text-ink-500 hover:text-ink-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
