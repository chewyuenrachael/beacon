/**
 * @ownership Resource Hub agent
 * @see `.cursor/rules/data-contracts.md` — Type file ownership
 */

export type ResourceCategory =
  | "event_playbook"
  | "training_video"
  | "slide_template"
  | "social_template"
  | "workshop_curriculum"
  | "faq";

/** Filesystem resource metadata (body loaded separately). */
export interface Resource {
  slug: string;
  title: string;
  category: ResourceCategory;
  content_path: string;
  last_updated: string;
}

/** Row shape for `resource_views` (Supabase). */
export interface ResourceView {
  id: string;
  resource_slug: string;
  viewer_id: string;
  viewed_at: string;
  time_on_page_seconds: number | null;
}

export interface ResourceWithBody extends Resource {
  body: string;
}
