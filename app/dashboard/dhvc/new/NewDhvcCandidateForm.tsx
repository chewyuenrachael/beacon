"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { DhvcSourceBadge } from "@/components/dhvc/DhvcSourceBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DHVC_SOURCES, type DhvcSource } from "@/lib/types";

interface InstitutionOption {
  id: string;
  name: string;
}

interface NewDhvcCandidateFormProps {
  institutions: InstitutionOption[];
}

interface SourceUrlDraft {
  url: string;
  source: DhvcSource;
  description: string;
}

const EMPTY_SOURCE_URL: SourceUrlDraft = {
  url: "",
  source: "manual",
  description: "",
};

export const NewDhvcCandidateForm: FC<NewDhvcCandidateFormProps> = ({
  institutions,
}) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [institutionId, setInstitutionId] = useState(
    institutions[0]?.id ?? ""
  );
  const [graduationYear, setGraduationYear] = useState("");
  const [major, setMajor] = useState("");
  const [sourceUrls, setSourceUrls] = useState<SourceUrlDraft[]>([
    { ...EMPTY_SOURCE_URL },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateSourceUrl(idx: number, patch: Partial<SourceUrlDraft>) {
    setSourceUrls((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }

  function addSourceUrl() {
    setSourceUrls((prev) => [...prev, { ...EMPTY_SOURCE_URL }]);
  }

  function removeSourceUrl(idx: number) {
    setSourceUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() && !githubUsername.trim() && !twitterHandle.trim()) {
      setError(
        "Provide at least one of: email, GitHub username, Twitter handle"
      );
      return;
    }

    const cleanedSourceUrls = sourceUrls
      .map((s) => ({
        url: s.url.trim(),
        source: s.source,
        description: s.description.trim(),
      }))
      .filter((s) => s.url && s.description);

    setLoading(true);
    try {
      const observedAt = new Date().toISOString();
      const body = {
        institution_id: institutionId,
        name: name.trim(),
        email: email.trim() || undefined,
        github_username: githubUsername.trim() || undefined,
        twitter_handle: twitterHandle.trim() || undefined,
        primary_source: "manual" as DhvcSource,
        source_urls: cleanedSourceUrls.map((s) => ({
          ...s,
          observed_at: observedAt,
        })),
        graduation_year: graduationYear.trim()
          ? Number(graduationYear)
          : undefined,
        major: major.trim() || undefined,
      };

      const res = await fetch("/api/dhvc/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      if (json.id) {
        router.push(`/dashboard/dhvc/${json.id}`);
        return;
      }
      setError("Missing id in response");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  const instOptions = institutions.map((i) => ({
    value: i.id,
    label: i.name,
  }));

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text-primary font-display">
          New DHVC candidate
        </h1>
        <Link
          href="/dashboard/dhvc"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Back to list
        </Link>
      </div>

      <p className="text-sm text-text-secondary">
        For candidates the Campus Lead meets in person. The submission is
        marked <code className="font-mono">primary_source: manual</code> and
        runs through the same scoring + observation pipeline as the scrapers.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="GitHub username"
          value={githubUsername}
          onChange={(e) => setGithubUsername(e.target.value)}
          placeholder="octocat"
        />
        <Input
          label="Twitter handle"
          value={twitterHandle}
          onChange={(e) => setTwitterHandle(e.target.value)}
          placeholder="without @"
        />
      </div>

      <Select
        label="Institution"
        value={institutionId}
        onChange={(e) => setInstitutionId(e.target.value)}
        options={instOptions}
        placeholder={institutions.length ? undefined : "No institutions"}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Graduation year"
          type="number"
          value={graduationYear}
          onChange={(e) => setGraduationYear(e.target.value)}
          placeholder="e.g. 2027"
        />
        <Input
          label="Major"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          placeholder="e.g. Computer Science"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-text-secondary font-medium">
          Source URLs
        </p>
        {sourceUrls.map((s, idx) => (
          <div
            key={idx}
            className="grid gap-2 sm:grid-cols-[1.4fr_0.7fr_1.4fr_auto] items-end p-3 border border-[#D0CCC4] rounded-md bg-white"
          >
            <Input
              label="URL"
              value={s.url}
              onChange={(e) => updateSourceUrl(idx, { url: e.target.value })}
            />
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
                Source
              </label>
              <select
                value={s.source}
                onChange={(e) =>
                  updateSourceUrl(idx, {
                    source: e.target.value as DhvcSource,
                  })
                }
                className="h-9 w-full rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
              >
                {DHVC_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
              <div className="mt-1">
                <DhvcSourceBadge source={s.source} />
              </div>
            </div>
            <Input
              label="Description"
              value={s.description}
              onChange={(e) =>
                updateSourceUrl(idx, { description: e.target.value })
              }
              placeholder="HackMIT 2025 finalist"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeSourceUrl(idx)}
              disabled={sourceUrls.length <= 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addSourceUrl}>
          Add another source URL
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-[#EDCFCF]/40 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={loading || !institutionId || !name.trim()}
      >
        {loading ? "Submitting…" : "Add candidate"}
      </Button>
    </form>
  );
};
