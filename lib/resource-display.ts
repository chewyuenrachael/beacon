/**
 * Display-only transforms for resource markdown.
 * Never mutates source files under content/resources/.
 */

export interface TocHeading {
  depth: 2 | 3;
  text: string;
  slug: string;
}

/**
 * Remove the leading `# …` heading when its text matches the resource title.
 * Prevents the duplicate title shown in the page shell header.
 */
export function stripLeadingTitle(md: string, title: string): string {
  const match = md.match(/^#\s+(.+?)(?:\n|$)/);
  if (!match) return md;
  if (normalize(match[1]) === normalize(title)) {
    return md.slice(match[0].length).trimStart();
  }
  return md;
}

/** words / 225, ceiling, formatted as "X min read" */
export function estimateReadTime(md: string): string {
  const words = md.split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 225));
  return `${mins} min read`;
}

/**
 * Extract h2 and h3 headings with slugs that match rehype-slug output.
 * Must use the same slugification: lowercase, collapse whitespace → hyphens,
 * strip non-alphanumeric except hyphens.
 */
export function extractHeadings(md: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const re = /^(#{2,3})\s+(.+?)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const depth = m[1].length as 2 | 3;
    const text = m[2].replace(/\*\*/g, "").replace(/`/g, "").trim();
    headings.push({ depth, text, slug: slugify(text) });
  }
  return headings;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** rehype-slug compatible: lowercase, hyphens for spaces, strip the rest */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
