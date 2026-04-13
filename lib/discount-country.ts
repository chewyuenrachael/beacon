/**
 * Map human-readable country labels (seed / UI) to ISO 3166-1 alpha-3 for choropleth maps.
 */
const LABEL_TO_ISO: Record<string, string> = {
  "united states": "USA",
  "united states of america": "USA",
  usa: "USA",
  india: "IND",
  romania: "ROU",
  italy: "ITA",
  "united kingdom": "GBR",
  uk: "GBR",
  japan: "JPN",
  germany: "DEU",
  france: "FRA",
  canada: "CAN",
  australia: "AUS",
};

export function countryLabelToIso3(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const k = label.trim().toLowerCase();
  return LABEL_TO_ISO[k] ?? null;
}

/** Forum-gap countries called out in the discount geography view. */
export const FORUM_GAP_ISO3 = ["IND", "ROU"] as const;
