import { createServerComponentClient } from "@/lib/supabase-server";
import { AmbassadorApplicationForm } from "./AmbassadorApplicationForm";

export default async function NewAmbassadorPage() {
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

  return <AmbassadorApplicationForm institutions={institutions ?? []} />;
}
