import Link from "next/link";
import { createServerComponentClient } from "@/lib/supabase";
import { NewEventForm } from "./NewEventForm";

export default async function NewEventPage() {
  const supabase = await createServerComponentClient();
  const { data: institutions } = await supabase
    .from("institutions")
    .select("id,name")
    .order("name");

  const options =
    (institutions ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
    })) ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <Link
          href="/dashboard/events"
          className="text-xs text-text-secondary hover:text-text-primary"
        >
          ← Events
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary font-display mt-2">
          New event
        </h1>
      </header>
      <NewEventForm institutions={options} />
    </div>
  );
}
