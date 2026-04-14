import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { VerificationAttempt } from "@/lib/types/discount";
import { VerificationQueue } from "@/components/discount/VerificationQueue";
import { Card } from "@/components/ui/Card";

function mapAttemptRow(row: Record<string, unknown>): VerificationAttempt {
  return {
    id: row.id as string,
    email: row.email as string,
    country: (row.country as string | null) ?? null,
    claimed_institution: (row.claimed_institution as string | null) ?? null,
    sheerid_response_code: row.sheerid_response_code as string,
    status: row.status as string,
    reviewed_by: (row.reviewed_by as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export default async function DiscountQueuePage() {
  const { data: attemptRows, error: aErr } = await supabaseAdmin
    .from("verification_attempts")
    .select("*")
    .order("created_at", { ascending: false });

  if (aErr) {
    return (
      <div className="text-sm text-red-700">
        Failed to load verification queue: {aErr.message}
      </div>
    );
  }

  const { data: instRows, error: iErr } = await supabaseAdmin
    .from("institutions")
    .select("id, name")
    .order("name", { ascending: true });

  if (iErr) {
    return (
      <div className="text-sm text-red-700">
        Failed to load institutions: {iErr.message}
      </div>
    );
  }

  const attempts = (attemptRows ?? []).map((r) =>
    mapAttemptRow(r as Record<string, unknown>)
  );
  const institutions = (instRows ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <Link
            href="/dashboard/discount"
            className="text-xs text-text-tertiary hover:text-text-primary mb-1 inline-block"
          >
            ← Discount overview
          </Link>
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Verification queue
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Default view: pending and manual review. Approve maps the user to
            an institution (observation + row update).
          </p>
        </div>
        <Link
          href="/dashboard/discount/geography"
          className="text-sm text-[#C45A3C] hover:underline"
        >
          Geography report →
        </Link>
      </div>

      <Card header="Attempts">
        <VerificationQueue attempts={attempts} institutions={institutions} />
      </Card>
    </div>
  );
}
