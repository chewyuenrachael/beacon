"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface EditableNotesFieldProps {
  candidateId: string;
  initialNotes: string;
  initialEmail: string;
  initialMajor: string;
  initialGraduationYear: number | undefined;
}

export const EditableNotesField: FC<EditableNotesFieldProps> = ({
  candidateId,
  initialNotes,
  initialEmail,
  initialMajor,
  initialGraduationYear,
}) => {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [email, setEmail] = useState(initialEmail);
  const [major, setMajor] = useState(initialMajor);
  const [gradYear, setGradYear] = useState(
    initialGraduationYear !== undefined ? String(initialGraduationYear) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {};
      if (notes !== initialNotes) body.notes = notes;
      if (email !== initialEmail) body.email = email || null;
      if (major !== initialMajor) body.major = major || null;
      const yearNum = gradYear === "" ? null : Number(gradYear);
      if (
        gradYear !== (initialGraduationYear?.toString() ?? "") &&
        (yearNum === null || Number.isFinite(yearNum))
      ) {
        body.graduation_year = yearNum;
      }

      if (Object.keys(body).length === 0) {
        setSaved(true);
        return;
      }

      const res = await fetch(`/api/dhvc/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Update failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="—"
        />
        <Input
          label="Graduation year"
          type="number"
          value={gradYear}
          onChange={(e) => setGradYear(e.target.value)}
          placeholder="e.g. 2027"
        />
        <Input
          label="Major"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          placeholder="e.g. Computer Science"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-[#D0CCC4] bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={onSave} disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
        {saved && (
          <span className="text-xs text-[#3D6B35]">Saved.</span>
        )}
        {error && <span className="text-xs text-[#8A2020]">{error}</span>}
      </div>
    </div>
  );
};
