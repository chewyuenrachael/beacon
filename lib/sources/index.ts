export const SOURCES = {
  arxiv: null,
  github: null,
  university_directories: null,
  course_syllabi: null,
  mlh: null,
} as const;

/** Normalize mention text for storage (Pulse port stub). */
export function cleanMentionText(text: string): string {
  return text.trim();
}