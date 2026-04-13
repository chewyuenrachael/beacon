export async function processFireMention(
  _fire: Record<string, unknown>
): Promise<{ is_new: boolean; incident_id: string }> {
  return { is_new: false, incident_id: "stub" };
}
