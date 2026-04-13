import fs from "node:fs";
import path from "node:path";
import type {
  Resource,
  ResourceCategory,
  ResourceWithBody,
} from "@/lib/types/resource";

const RESOURCES_DIR = path.join(process.cwd(), "content/resources");

const VALID_CATEGORIES: readonly ResourceCategory[] = [
  "event_playbook",
  "training_video",
  "slide_template",
  "social_template",
  "workshop_curriculum",
  "faq",
] as const;

export function isSafeSlug(slug: string): boolean {
  if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return false;
  }
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function isResourceCategory(s: string): s is ResourceCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(s);
}

/** Minimal YAML frontmatter: key: value lines only. */
export function parseResourceFile(raw: string): {
  title: string;
  category: ResourceCategory;
  last_updated: string;
  body: string;
} {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    throw new Error("Resource markdown must start with YAML frontmatter (---)");
  }
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error("Resource markdown missing closing --- for frontmatter");
  }
  const block = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 4).trimStart();

  const meta: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^([a-z_]+):\s*(.*)$/i.exec(line.trim());
    if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, "");
  }

  const title = meta.title;
  const categoryRaw = meta.category;
  const last_updated = meta.last_updated;

  if (!title) throw new Error("Frontmatter must include title");
  if (!categoryRaw || !isResourceCategory(categoryRaw)) {
    throw new Error(`Frontmatter category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }
  if (!last_updated) throw new Error("Frontmatter must include last_updated (ISO date)");

  return {
    title,
    category: categoryRaw,
    last_updated,
    body,
  };
}

function readResourceFile(slug: string): ResourceWithBody {
  if (!isSafeSlug(slug)) {
    throw new Error("Invalid resource slug");
  }
  const filePath = path.join(RESOURCES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error("NOT_FOUND");
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseResourceFile(raw);
  const content_path = path.posix.join("content/resources", `${slug}.md`);
  return {
    slug,
    title: parsed.title,
    category: parsed.category,
    content_path,
    last_updated: parsed.last_updated,
    body: parsed.body,
  };
}

/** Uncached scan of `content/resources` (used by tests and server wrapper). */
export async function listResourcesFromDisk(): Promise<Resource[]> {
  if (!fs.existsSync(RESOURCES_DIR)) {
    return [];
  }
  const names = fs.readdirSync(RESOURCES_DIR).filter((f) => f.endsWith(".md"));
  const resources: Resource[] = [];
  for (const name of names) {
    const slug = name.replace(/\.md$/i, "");
    if (!isSafeSlug(slug)) continue;
    try {
      const full = readResourceFile(slug);
      resources.push({
        slug: full.slug,
        title: full.title,
        category: full.category,
        content_path: full.content_path,
        last_updated: full.last_updated,
      });
    } catch (e) {
      console.error("[resource-content] skip", name, e);
    }
  }
  resources.sort((a, b) => a.title.localeCompare(b.title));
  return resources;
}

export async function getResourceFromDisk(
  slug: string
): Promise<ResourceWithBody | null> {
  if (!isSafeSlug(slug)) return null;
  try {
    return readResourceFile(slug);
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") return null;
    throw e;
  }
}
