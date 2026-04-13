export async function detectPropagation(): Promise<{
  new_clusters: number;
  updated_clusters: number;
  resolved_clusters: number;
}> {
  return { new_clusters: 0, updated_clusters: 0, resolved_clusters: 0 };
}
