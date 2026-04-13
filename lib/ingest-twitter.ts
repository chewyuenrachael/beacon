export interface TwitterIngestResult {
  ingested: number;
  skipped: number;
}

export async function ingestTwitter(): Promise<TwitterIngestResult> {
  return { ingested: 0, skipped: 0 };
}
