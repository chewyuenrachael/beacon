"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { KeywordRow, IngestionLogRow, Audience } from "@/lib/types";
import type { LLMProbe, ProbeCategory } from "@/app/dashboard/llm-monitor/types";
import { PROBE_CATEGORIES, PLATFORM_LABELS } from "@/app/dashboard/llm-monitor/types";
import type { ResponseTemplate, DraftChannel } from "@/app/dashboard/warroom/types";
import { CHANNEL_CONFIG } from "@/app/dashboard/warroom/types";
import NarrativeSettings from "@/components/NarrativeSettings";

const AUDIENCE_EMOJI: Record<string, string> = {
  comms: "📡",
  product: "🛠️",
  engineering: "⚙️",
  safety: "🛡️",
  policy: "🏛️",
  executive: "👔",
};

const CATEGORY_STYLES: Record<string, string> = {
  primary: "bg-blue-50 text-blue-700 border-blue-200",
  competitor: "bg-violet-50 text-violet-700 border-violet-200",
  context: "bg-gray-50 text-gray-600 border-gray-200",
};

const SOURCE_DISPLAY: Record<string, string> = {
  hackernews: "Hacker News",
  reddit: "Reddit",
  youtube: "YouTube",
  rss: "RSS Feeds",
  twitter: "\uD835\uDD4F / Twitter",
  discord: "Discord",
};

export default function SettingsPage() {
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [logs, setLogs] = useState<IngestionLogRow[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState<"primary" | "competitor" | "context">("primary");
  const [loadingKeywords, setLoadingKeywords] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [triggerStatus, setTriggerStatus] = useState<Record<string, string>>({});
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savedWebhookUrl, setSavedWebhookUrl] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [audienceEdits, setAudienceEdits] = useState<Record<string, { webhook: string; channel: string; active: boolean }>>({});
  const [audienceSaveStatus, setAudienceSaveStatus] = useState<Record<string, string>>({});
  const [generateStatus, setGenerateStatus] = useState<string | null>(null);
  const [probes, setProbes] = useState<LLMProbe[]>([]);
  const [loadingProbes, setLoadingProbes] = useState(true);
  const [newProbePrompt, setNewProbePrompt] = useState("");
  const [newProbeCategory, setNewProbeCategory] = useState<ProbeCategory>("product-comparison");
  const [newProbeFrequency, setNewProbeFrequency] = useState<"daily" | "weekly">("weekly");
  const [llmRunStatus, setLlmRunStatus] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, boolean>>({});

  // Twitter/Discord config state
  const [twitterAccounts, setTwitterAccounts] = useState<{ id: string; username: string; display_name: string | null; category: string; is_active: boolean }[]>([]);
  const [discordChannels, setDiscordChannels] = useState<{ id: string; server_name: string | null; channel_name: string | null; channel_id: string; category: string; is_active: boolean }[]>([]);
  const [newTwitterUsername, setNewTwitterUsername] = useState("");
  const [newTwitterCategory, setNewTwitterCategory] = useState("influencer");

  // Templates state
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [templateEdits, setTemplateEdits] = useState<Record<string, { title: string; template_body: string; channel: DraftChannel; placeholders: string[] }>>({});
  const [templateSaveStatus, setTemplateSaveStatus] = useState<Record<string, string>>({});
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] = useState("");
  const [newTemplateChannel, setNewTemplateChannel] = useState<DraftChannel>("statement");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplatePlaceholders, setNewTemplatePlaceholders] = useState("");

  useEffect(() => {
    document.title = "Settings \u2014 Beacon";
    fetchKeywords();
    fetchLogs();
    fetchSettings();
    fetchAudiences();
    fetchProbes();
    fetchTemplates();
    fetchTwitterAccounts();
    fetchDiscordChannels();
  }, []);

  async function fetchKeywords() {
    try {
      const res = await fetch("/api/keywords");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setKeywords(Array.isArray(data) ? data : data.data || []);
    } catch {
      // non-critical
    }
    setLoadingKeywords(false);
  }

  async function fetchLogs() {
    try {
      const res = await fetch("/api/mentions?limit=1");
      // Try dedicated logs endpoint if available
      const logsRes = await fetch("/api/stats/regions").catch(() => null);
      // Fallback: just show we tried
      void logsRes;
    } catch {
      // non-critical
    }
    setLoadingLogs(false);
  }

  async function fetchTwitterAccounts() {
    try {
      const res = await fetch("/api/sources/twitter/accounts");
      if (res.ok) {
        const data = await res.json();
        setTwitterAccounts(Array.isArray(data) ? data : []);
      }
    } catch {
      // non-critical
    }
  }

  async function fetchDiscordChannels() {
    try {
      const res = await fetch("/api/sources/discord/channels");
      if (res.ok) {
        const data = await res.json();
        setDiscordChannels(Array.isArray(data) ? data : []);
      }
    } catch {
      // non-critical
    }
  }

  async function handleAddTwitterAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newTwitterUsername.trim()) return;
    try {
      const res = await fetch("/api/sources/twitter/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newTwitterUsername.trim().replace(/^@/, ""),
          category: newTwitterCategory,
        }),
      });
      if (res.ok) {
        setNewTwitterUsername("");
        fetchTwitterAccounts();
      }
    } catch {
      // non-critical
    }
  }

  async function handleDeleteTwitterAccount(id: string) {
    try {
      const res = await fetch("/api/sources/twitter/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchTwitterAccounts();
    } catch {
      // non-critical
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.slack_webhook_url) {
          setWebhookUrl(data.slack_webhook_url);
          setSavedWebhookUrl(data.slack_webhook_url);
        }
      }
    } catch {
      // non-critical
    }
  }

  async function fetchAudiences() {
    try {
      const res = await fetch("/api/audiences");
      if (res.ok) {
        const data: Audience[] = await res.json();
        setAudiences(data);
        const edits: Record<string, { webhook: string; channel: string; active: boolean }> = {};
        for (const a of data) {
          edits[a.slug] = {
            webhook: a.slack_webhook_url || "",
            channel: a.slack_channel_name || "",
            active: a.is_active,
          };
        }
        setAudienceEdits(edits);
      }
    } catch {
      // non-critical
    }
  }

  async function saveAudience(slug: string) {
    const edit = audienceEdits[slug];
    if (!edit) return;
    setAudienceSaveStatus((p) => ({ ...p, [slug]: "saving" }));
    try {
      const res = await fetch("/api/audiences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          slack_webhook_url: edit.webhook || null,
          slack_channel_name: edit.channel || null,
          is_active: edit.active,
        }),
      });
      if (res.ok) {
        setAudienceSaveStatus((p) => ({ ...p, [slug]: "saved" }));
        setTimeout(() => setAudienceSaveStatus((p) => ({ ...p, [slug]: "" })), 3000);
      } else {
        setAudienceSaveStatus((p) => ({ ...p, [slug]: "error" }));
      }
    } catch {
      setAudienceSaveStatus((p) => ({ ...p, [slug]: "error" }));
    }
  }

  async function testAudienceWebhook(slug: string) {
    const edit = audienceEdits[slug];
    if (!edit?.webhook) return;
    try {
      await fetch(edit.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Test from Beacon*\n${AUDIENCE_EMOJI[slug] || "📋"} ${slug} brief delivery configured!`,
            },
          }],
        }),
      });
      setAudienceSaveStatus((p) => ({ ...p, [slug]: "test sent" }));
      setTimeout(() => setAudienceSaveStatus((p) => ({ ...p, [slug]: "" })), 4000);
    } catch {
      setAudienceSaveStatus((p) => ({ ...p, [slug]: "test failed" }));
    }
  }

  async function handleGenerateAll() {
    setGenerateStatus("Generating...");
    try {
      const res = await fetch("/api/briefs/audience", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGenerateStatus(`Done! ${data.generated} brief${data.generated !== 1 ? "s" : ""} generated.`);
      } else {
        setGenerateStatus("Generation failed");
      }
    } catch {
      setGenerateStatus("Generation failed");
    }
    setTimeout(() => setGenerateStatus(null), 5000);
  }

  async function saveWebhook() {
    setWebhookStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slack_webhook_url: webhookUrl }),
      });
      if (res.ok) {
        setWebhookStatus("saved");
        setSavedWebhookUrl(webhookUrl);
        setTimeout(() => setWebhookStatus(null), 3000);
      } else {
        const err = await res.json();
        setWebhookStatus(err.error || "Failed to save");
      }
    } catch {
      setWebhookStatus("Failed to save");
    }
  }

  async function testWebhook() {
    try {
      await fetch(savedWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Test fire alert from Beacon*\nThis is a test. If you see this, fire alerts are working.",
              },
            },
          ],
        }),
      });
      setWebhookStatus("Test sent — check your Slack channel");
      setTimeout(() => setWebhookStatus(null), 4000);
    } catch {
      setWebhookStatus("Test failed — check the webhook URL");
    }
  }

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword.trim(), category: newCategory }),
      });
      if (res.ok) {
        setNewKeyword("");
        fetchKeywords();
      }
    } catch {
      // silently fail
    }
  }

  async function handleDeleteKeyword(id: string) {
    try {
      const res = await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeywords((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      // silently fail
    }
  }

  async function fetchProbes() {
    try {
      const res = await fetch("/api/llm-monitor/probes");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProbes(Array.isArray(data) ? data : data.data || []);
      if (data.api_keys) setApiKeyStatus(data.api_keys);
    } catch {
      // non-critical
    }
    setLoadingProbes(false);
  }

  async function handleAddProbe(e: React.FormEvent) {
    e.preventDefault();
    if (!newProbePrompt.trim()) return;
    try {
      const res = await fetch("/api/llm-monitor/probes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_text: newProbePrompt.trim(),
          category: newProbeCategory,
          frequency: newProbeFrequency,
        }),
      });
      if (res.ok) {
        setNewProbePrompt("");
        fetchProbes();
      }
    } catch {
      // silently fail
    }
  }

  async function handleDeleteProbe(id: string) {
    try {
      const res = await fetch(`/api/llm-monitor/probes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setProbes((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // silently fail
    }
  }

  async function handleToggleProbe(id: string, active: boolean) {
    try {
      await fetch("/api/llm-monitor/probes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: active }),
      });
      setProbes((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: active } : p))
      );
    } catch {
      // silently fail
    }
  }

  async function handleRunLLMMonitoring() {
    setLlmRunStatus("Running...");
    try {
      const res = await fetch("/api/llm-monitor/run", { method: "POST" });
      if (res.ok) {
        setLlmRunStatus("Done!");
      } else {
        setLlmRunStatus("Failed");
      }
    } catch {
      setLlmRunStatus("Failed");
    }
    setTimeout(() => setLlmRunStatus(null), 4000);
  }

  async function handleTrigger(action: "ingest" | "brief") {
    const key = action;
    setTriggerStatus((prev) => ({ ...prev, [key]: "running" }));
    try {
      const url = action === "ingest" ? "/api/ingest" : "/api/brief";
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        setTriggerStatus((prev) => ({ ...prev, [key]: "done" }));
      } else {
        setTriggerStatus((prev) => ({ ...prev, [key]: "error" }));
      }
    } catch {
      setTriggerStatus((prev) => ({ ...prev, [key]: "error" }));
    }
    setTimeout(() => {
      setTriggerStatus((prev) => ({ ...prev, [key]: "" }));
    }, 3000);
  }

  async function fetchTemplates() {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const arr: ResponseTemplate[] = Array.isArray(data) ? data : data.data || [];
      setTemplates(arr);
      const edits: Record<string, { title: string; template_body: string; channel: DraftChannel; placeholders: string[] }> = {};
      for (const t of arr) {
        edits[t.id] = { title: t.title, template_body: t.template_body, channel: t.channel, placeholders: t.placeholders };
      }
      setTemplateEdits(edits);
    } catch {
      // non-critical
    }
    setLoadingTemplates(false);
  }

  async function saveTemplate(id: string) {
    const edit = templateEdits[id];
    if (!edit) return;
    setTemplateSaveStatus((p) => ({ ...p, [id]: "saving" }));
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      if (res.ok) {
        setTemplateSaveStatus((p) => ({ ...p, [id]: "saved" }));
        setTimeout(() => setTemplateSaveStatus((p) => ({ ...p, [id]: "" })), 3000);
        fetchTemplates();
      } else {
        setTemplateSaveStatus((p) => ({ ...p, [id]: "error" }));
      }
    } catch {
      setTemplateSaveStatus((p) => ({ ...p, [id]: "error" }));
    }
  }

  async function deactivateTemplate(id: string) {
    try {
      await fetch(`/api/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      fetchTemplates();
    } catch {
      // silent
    }
  }

  async function handleAddTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTemplateName.trim() || !newTemplateBody.trim()) return;
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTemplateName.trim(),
          scenario_type: newTemplateType.trim() || "general",
          channel: newTemplateChannel,
          template_body: newTemplateBody,
          placeholders: newTemplatePlaceholders.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        setNewTemplateName("");
        setNewTemplateType("");
        setNewTemplateChannel("statement");
        setNewTemplateBody("");
        setNewTemplatePlaceholders("");
        setShowAddTemplate(false);
        fetchTemplates();
      }
    } catch {
      // silent
    }
  }

  // Group templates by scenario_type
  const groupedTemplates: Record<string, ResponseTemplate[]> = {};
  for (const t of templates) {
    const key = t.scenario_type || "General";
    if (!groupedTemplates[key]) groupedTemplates[key] = [];
    groupedTemplates[key].push(t);
  }

  const DRAFT_CHANNELS: DraftChannel[] = ["statement", "social", "internal", "press", "blog"];

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">Settings</h1>

      {/* Slack fire alerts */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Slack fire alerts
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-4">
            Get instant Slack notifications when a fire is detected. Only fires
            trigger alerts — moments, signals, and noise stay in the dashboard.
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <button
              onClick={saveWebhook}
              className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
            >
              Save
            </button>
          </div>
          {savedWebhookUrl && (
            <button
              onClick={testWebhook}
              className="mt-3 text-xs text-accent-terracotta hover:underline"
            >
              Send test alert &rarr;
            </button>
          )}
          {webhookStatus && (
            <p
              className={`text-xs mt-2 ${
                webhookStatus === "saved"
                  ? "text-emerald-600"
                  : webhookStatus.startsWith("Test sent")
                    ? "text-emerald-600"
                    : "text-red-600"
              }`}
            >
              {webhookStatus === "saved" ? "Webhook saved" : webhookStatus}
            </p>
          )}
        </div>
      </section>

      {/* Audience Brief Delivery */}
      {audiences.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Audience brief delivery
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {audiences.map((aud) => {
              const edit = audienceEdits[aud.slug] || { webhook: "", channel: "", active: true };
              const status = audienceSaveStatus[aud.slug] || "";
              return (
                <div key={aud.slug} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{AUDIENCE_EMOJI[aud.slug] || "📋"}</span>
                    <span className="text-sm font-medium text-gray-900">{aud.display_name}</span>
                    <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                      <span className="text-xs text-gray-400">Active</span>
                      <button
                        onClick={() =>
                          setAudienceEdits((p) => ({
                            ...p,
                            [aud.slug]: { ...edit, active: !edit.active },
                          }))
                        }
                        className={`w-8 h-4 rounded-full transition-colors relative ${
                          edit.active ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            edit.active ? "left-4" : "left-0.5"
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={edit.webhook}
                      onChange={(e) =>
                        setAudienceEdits((p) => ({
                          ...p,
                          [aud.slug]: { ...edit, webhook: e.target.value },
                        }))
                      }
                      className="flex-1 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="#channel"
                      value={edit.channel}
                      onChange={(e) =>
                        setAudienceEdits((p) => ({
                          ...p,
                          [aud.slug]: { ...edit, channel: e.target.value },
                        }))
                      }
                      className="w-28 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <button
                      onClick={() => saveAudience(aud.slug)}
                      className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Save
                    </button>
                    {edit.webhook && (
                      <button
                        onClick={() => testAudienceWebhook(aud.slug)}
                        className="text-xs text-accent-terracotta hover:underline"
                      >
                        Test
                      </button>
                    )}
                  </div>
                  {status && (
                    <p className={`text-xs mt-1.5 ${
                      status === "saved" || status === "test sent"
                        ? "text-emerald-600"
                        : status === "saving"
                          ? "text-gray-400"
                          : "text-red-600"
                    }`}>
                      {status === "saved" ? "Saved" : status === "saving" ? "Saving..." : status}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <button
              onClick={handleGenerateAll}
              disabled={generateStatus === "Generating..."}
              className="text-sm border border-gray-200 rounded-md px-4 py-2 hover:border-gray-300 disabled:opacity-50 transition-colors"
            >
              {generateStatus || "Generate all briefs now"}
            </button>
          </div>
        </section>
      )}

      {/* Narrative Priorities */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Narrative priorities
        </h2>
        <NarrativeSettings />
      </section>

      {/* Response Templates */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Response Templates
        </h2>
        {loadingTemplates ? (
          <div className="bg-white border border-gray-200 rounded-lg p-4 animate-beacon">
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
          </div>
        ) : (
          <div className="space-y-4">
            {templates.length === 0 && !showAddTemplate ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-400">No templates configured.</p>
              </div>
            ) : (
              Object.entries(groupedTemplates).map(([type, tmpls]) => (
                <div key={type}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{type}</p>
                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {tmpls.map((t) => {
                      const isExpanded = expandedTemplate === t.id;
                      const edit = templateEdits[t.id];
                      const status = templateSaveStatus[t.id] || "";
                      const ch = CHANNEL_CONFIG[t.channel] || { emoji: "📄", label: t.channel };
                      return (
                        <div key={t.id} className="px-4 py-3">
                          <button
                            onClick={() => setExpandedTemplate(isExpanded ? null : t.id)}
                            className="w-full text-left flex items-center gap-2"
                          >
                            <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-100 text-ink-500 border border-cream-200">
                              {ch.emoji} {ch.label}
                            </span>
                            <span className="text-sm font-medium text-gray-900 flex-1">{t.title}</span>
                            {t.usage_count > 0 && (
                              <span className="text-xs text-gray-400">Used {t.usage_count} times</span>
                            )}
                            {!t.is_active && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Inactive</span>
                            )}
                          </button>
                          {isExpanded && edit && (
                            <div className="mt-3 space-y-2 pl-5">
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Title</label>
                                <input
                                  type="text"
                                  value={edit.title}
                                  onChange={(e) => setTemplateEdits((p) => ({ ...p, [t.id]: { ...edit, title: e.target.value } }))}
                                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Channel</label>
                                <select
                                  value={edit.channel}
                                  onChange={(e) => setTemplateEdits((p) => ({ ...p, [t.id]: { ...edit, channel: e.target.value as DraftChannel } }))}
                                  className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                  {DRAFT_CHANNELS.map((c) => (
                                    <option key={c} value={c}>{CHANNEL_CONFIG[c]?.emoji} {CHANNEL_CONFIG[c]?.label || c}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Body</label>
                                <textarea
                                  value={edit.template_body}
                                  onChange={(e) => setTemplateEdits((p) => ({ ...p, [t.id]: { ...edit, template_body: e.target.value } }))}
                                  rows={8}
                                  className="w-full text-sm font-mono border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Placeholders</label>
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {edit.placeholders.map((p, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                                      {`{{${p}}}`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => saveTemplate(t.id)}
                                  className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                                >
                                  Save
                                </button>
                                {t.is_active && (
                                  <button
                                    onClick={() => deactivateTemplate(t.id)}
                                    className="text-xs text-red-600 hover:underline"
                                  >
                                    Deactivate
                                  </button>
                                )}
                                {status && (
                                  <span className={`text-xs ${status === "saved" ? "text-emerald-600" : status === "saving" ? "text-gray-400" : "text-red-600"}`}>
                                    {status === "saved" ? "Saved" : status === "saving" ? "Saving..." : "Error"}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Add template */}
            {showAddTemplate ? (
              <form onSubmit={handleAddTemplate} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-900">New Template</h3>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Title</label>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Template title"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Scenario type</label>
                    <input
                      type="text"
                      value={newTemplateType}
                      onChange={(e) => setNewTemplateType(e.target.value)}
                      placeholder="e.g. model-safety"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Channel</label>
                  <select
                    value={newTemplateChannel}
                    onChange={(e) => setNewTemplateChannel(e.target.value as DraftChannel)}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {DRAFT_CHANNELS.map((c) => (
                      <option key={c} value={c}>{CHANNEL_CONFIG[c]?.emoji} {CHANNEL_CONFIG[c]?.label || c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Body</label>
                  <textarea
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                    rows={6}
                    placeholder="Template body with {{placeholders}}..."
                    className="w-full text-sm font-mono border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Placeholders (comma-separated)</label>
                  <input
                    type="text"
                    value={newTemplatePlaceholders}
                    onChange={(e) => setNewTemplatePlaceholders(e.target.value)}
                    placeholder="incident_summary, company_name, date"
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!newTemplateName.trim() || !newTemplateBody.trim()}
                    className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
                  >
                    Add Template
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddTemplate(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddTemplate(true)}
                className="text-sm text-accent-terracotta hover:underline"
              >
                + Add Template
              </button>
            )}
          </div>
        )}
      </section>

      {/* LLM Monitoring Probes */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          LLM monitoring probes
        </h2>

        {/* API key status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2">API Key Status</p>
          <div className="space-y-1">
            {Object.entries(PLATFORM_LABELS).map(([key, name]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{name}</span>
                <span className={apiKeyStatus[key] ? "text-emerald-600" : "text-red-500"}>
                  {apiKeyStatus[key] ? "\u2713 API key configured" : "\u2717 No API key"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {loadingProbes ? (
          <div className="bg-white border border-gray-200 rounded-lg p-4 animate-beacon">
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 space-y-2">
              {probes.length === 0 ? (
                <p className="text-sm text-gray-400">No probes configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {probes.map((probe) => (
                    <div
                      key={probe.id}
                      className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 line-clamp-2" title={probe.prompt_text}>
                          {probe.prompt_text}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                            {probe.category.replace(/-/g, " ")}
                          </span>
                          <span className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full">
                            {probe.frequency}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleProbe(probe.id, !probe.is_active)}
                        className={`shrink-0 w-8 h-4 rounded-full transition-colors relative ${
                          probe.is_active ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            probe.is_active ? "left-4" : "left-0.5"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteProbe(probe.id)}
                        className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-sm"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form
              onSubmit={handleAddProbe}
              className="border-t border-gray-100 px-4 py-3 space-y-2"
            >
              <textarea
                value={newProbePrompt}
                onChange={(e) => setNewProbePrompt(e.target.value)}
                placeholder="Enter probe prompt, e.g. 'What is the best AI coding assistant?'"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newProbeCategory}
                  onChange={(e) => setNewProbeCategory(e.target.value as ProbeCategory)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  {PROBE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/-/g, " ")}
                    </option>
                  ))}
                </select>
                <select
                  value={newProbeFrequency}
                  onChange={(e) => setNewProbeFrequency(e.target.value as "daily" | "weekly")}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button
                  type="submit"
                  className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-3">
          <button
            onClick={handleRunLLMMonitoring}
            disabled={llmRunStatus === "Running..."}
            className="text-sm border border-gray-200 rounded-md px-4 py-2 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {llmRunStatus || "Run LLM monitoring now"}
          </button>
        </div>
      </section>

      {/* Keywords */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">Keywords</h2>

        {loadingKeywords ? (
          <div className="bg-white border border-gray-200 rounded-lg p-4 animate-beacon">
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 space-y-2">
              {keywords.length === 0 ? (
                <p className="text-sm text-gray-400">No keywords configured.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k) => (
                    <span
                      key={k.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                        CATEGORY_STYLES[k.category] || CATEGORY_STYLES.context
                      }`}
                    >
                      {k.keyword}
                      <button
                        onClick={() => handleDeleteKeyword(k.id)}
                        className="text-current opacity-40 hover:opacity-100 transition-opacity"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <form
              onSubmit={handleAddKeyword}
              className="border-t border-gray-100 px-4 py-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword..."
                className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as "primary" | "competitor" | "context")}
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                <option value="primary">Primary</option>
                <option value="competitor">Competitor</option>
                <option value="context">Context</option>
              </select>
              <button
                type="submit"
                className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
              >
                Add
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Twitter/X Accounts */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          {"\uD835\uDD4F"} / Twitter Monitored Accounts
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 space-y-2">
            {twitterAccounts.length === 0 ? (
              <p className="text-sm text-gray-400">
                No Twitter accounts configured. Add accounts to monitor tweets from specific users.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {twitterAccounts.map((acct) => (
                  <div key={acct.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-700">@{acct.username}</span>
                      {acct.display_name && (
                        <span className="text-xs text-gray-400">{acct.display_name}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {acct.category}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteTwitterAccount(acct.id)}
                      className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <form
            onSubmit={handleAddTwitterAccount}
            className="border-t border-gray-100 px-4 py-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={newTwitterUsername}
              onChange={(e) => setNewTwitterUsername(e.target.value)}
              placeholder="@username"
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <select
              value={newTwitterCategory}
              onChange={(e) => setNewTwitterCategory(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="anthropic-official">Official</option>
              <option value="influencer">Influencer</option>
              <option value="tech-journalist">Journalist</option>
              <option value="ai-researcher">Researcher</option>
              <option value="developer-advocate">Dev Advocate</option>
              <option value="competitor-official">Competitor</option>
              <option value="general">General</option>
            </select>
            <button
              type="submit"
              className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
            >
              Add
            </button>
          </form>
        </div>
        {!process.env.NEXT_PUBLIC_TWITTER_CONFIGURED && (
          <p className="text-xs text-gray-400 mt-1.5">
            Requires TWITTER_BEARER_TOKEN environment variable.
          </p>
        )}
      </section>

      {/* Discord Channels */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Discord Monitored Channels
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 space-y-2">
            {discordChannels.length === 0 ? (
              <p className="text-sm text-gray-400">
                No Discord channels configured. Add channels to monitor messages.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {discordChannels.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">
                        {ch.server_name || "Unknown Server"} / #{ch.channel_name || ch.channel_id}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5865F2]/10 text-[#5865F2]">
                        {ch.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Configure channels in the discord_monitored_channels table. Requires DISCORD_BOT_TOKEN environment variable.
        </p>
      </section>

      {/* Source status */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Source Status
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {["hackernews", "reddit", "youtube", "rss", "twitter", "discord"].map((source) => {
            const log = logs.find((l) => l.source === source);
            return (
              <div key={source} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-700">{SOURCE_DISPLAY[source] || source}</span>
                <span className="text-xs text-gray-400">
                  {log?.completed_at
                    ? `Last run ${formatDistanceToNow(new Date(log.completed_at), { addSuffix: true })}`
                    : "No data yet"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Manual triggers */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Manual Triggers
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleTrigger("ingest")}
            disabled={triggerStatus.ingest === "running"}
            className="text-sm border border-gray-200 rounded-md px-4 py-2 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {triggerStatus.ingest === "running"
              ? "Running..."
              : triggerStatus.ingest === "done"
                ? "Done!"
                : triggerStatus.ingest === "error"
                  ? "Failed"
                  : "Run ingestion now"}
          </button>
          <button
            onClick={() => handleTrigger("brief")}
            disabled={triggerStatus.brief === "running"}
            className="text-sm border border-gray-200 rounded-md px-4 py-2 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {triggerStatus.brief === "running"
              ? "Generating..."
              : triggerStatus.brief === "done"
                ? "Done!"
                : triggerStatus.brief === "error"
                  ? "Failed"
                  : "Generate brief now"}
          </button>
        </div>
      </section>
    </div>
  );
}
