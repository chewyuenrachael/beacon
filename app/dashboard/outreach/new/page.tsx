import Link from "next/link";
import { createServerComponentClient } from "@/lib/supabase";
import { NewOutreachForm } from "./NewOutreachForm";

export default async function NewOutreachPage() {
  const supabase = await createServerComponentClient();
  const { data: profs, error } = await supabase
    .from("professors")
    .select("id, name, institution_id")
    .order("name");

  if (error) {
    return (
      <div className="text-sm text-red-600">Could not load professors: {error.message}</div>
    );
  }

  const professorOptions =
    (profs ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      institution_id: p.institution_id as string,
    })) ?? [];

  return (
    <div className="max-w-lg space-y-6">
      <Link
        href="/dashboard/outreach"
        className="text-xs text-ink-500 hover:text-ink-700 inline-block"
      >
        ← Outreach
      </Link>
      <h1 className="text-2xl font-semibold text-ink-900 font-display">
        New touchpoint
      </h1>
      <NewOutreachForm professorOptions={professorOptions} />
    </div>
  );
}
