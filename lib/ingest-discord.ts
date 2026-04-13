export interface DiscordIngestResult {
  ingested: number;
  skipped: number;
}

export async function ingestDiscord(): Promise<DiscordIngestResult> {
  return { ingested: 0, skipped: 0 };
}
