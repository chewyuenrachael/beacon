import { createServerComponentClient } from "@/lib/supabase-server";
import { NewDhvcCandidateForm } from "./NewDhvcCandidateForm";

export default async function NewDhvcCandidatePage() {
  const supabase = await createServerComponentClient();
  const { data: institutions, error } = await supabase
    .from("institutions")
    .select("id, name")
    .order("name");

  if (error) {
    return (
      <p className="text-sm text-text-secondary">
        Failed to load institutions: {error.message}
      </p>
    );
  }

  const opts = (institutions ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
  }));

  return <NewDhvcCandidateForm institutions={opts} />;
}
