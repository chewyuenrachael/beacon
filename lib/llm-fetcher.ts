export type FetchedLLMResponseRow = {
  probe_id: string;
  platform: string;
  response_text: string;
  model_version: string;
  stored_id: string | null;
};

export async function fetchLLMResponses(
  _probes: { id: string; prompt_text: string }[],
  _platforms: string[]
): Promise<FetchedLLMResponseRow[]> {
  return [];
}
