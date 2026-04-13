import "server-only";

import { cache } from "react";
import {
  getResourceFromDisk,
  listResourcesFromDisk,
  isSafeSlug,
} from "@/lib/resource-content-core";

export { parseResourceFile } from "@/lib/resource-content-core";

/** All resource metadata; cached per request (React cache). */
export const listResources = cache(listResourcesFromDisk);

/** Full resource including markdown body; cached per request. */
export const getResource = cache(getResourceFromDisk);

export async function resourceSlugExists(slug: string): Promise<boolean> {
  const all = await listResources();
  return all.some((r) => r.slug === slug);
}

export { isSafeSlug };
