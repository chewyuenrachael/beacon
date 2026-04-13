"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface InstitutionOption {
  id: string;
  name: string;
}

interface AmbassadorApplicationFormProps {
  institutions: InstitutionOption[];
}

export const AmbassadorApplicationForm: FC<AmbassadorApplicationFormProps> = ({
  institutions,
}) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [institutionId, setInstitutionId] = useState(
    institutions[0]?.id ?? ""
  );
  const [whyCursor, setWhyCursor] = useState("");
  const [pastCommunity, setPastCommunity] = useState("");
  const [proposedEvents, setProposedEvents] = useState("");
  const [expectedReach, setExpectedReach] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ambassadors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          github_username: githubUsername.trim() || undefined,
          institution_id: institutionId,
          application_data: {
            why_cursor: whyCursor,
            past_community_work: pastCommunity,
            proposed_events: proposedEvents,
            expected_reach: expectedReach,
          },
        }),
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
        router.push(`/dashboard/ambassadors/${json.id}`);
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
          New ambassador application
        </h1>
        <Link
          href="/dashboard/ambassadors"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Back to list
        </Link>
      </div>

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
          required
        />
      </div>

      <Input
        label="GitHub username"
        value={githubUsername}
        onChange={(e) => setGithubUsername(e.target.value)}
        placeholder="octocat"
      />

      <Select
        label="Institution"
        value={institutionId}
        onChange={(e) => setInstitutionId(e.target.value)}
        options={instOptions}
        placeholder={institutions.length ? undefined : "No institutions"}
      />

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-text-secondary font-medium">
          Application (JSON fields)
        </p>
        <Input
          label="Why Cursor?"
          value={whyCursor}
          onChange={(e) => setWhyCursor(e.target.value)}
        />
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Past community work
          </label>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-[#D0CCC4] bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
            value={pastCommunity}
            onChange={(e) => setPastCommunity(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Proposed events
          </label>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-[#D0CCC4] bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
            value={proposedEvents}
            onChange={(e) => setProposedEvents(e.target.value)}
          />
        </div>
        <Input
          label="Expected reach"
          value={expectedReach}
          onChange={(e) => setExpectedReach(e.target.value)}
          placeholder="e.g. 200 students"
        />
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-[#EDCFCF]/40 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={loading || !institutionId}>
        {loading ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
};
