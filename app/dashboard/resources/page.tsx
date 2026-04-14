import Link from "next/link";
import { listResources } from "@/lib/resource-content";
import { ResourcesHubClient } from "./ResourcesHubClient";

export default async function ResourcesPage() {
  const resources = await listResources();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/dashboard/resources/analytics"
          className="text-sm text-accent hover:underline font-medium"
        >
          View analytics
        </Link>
      </div>
      <ResourcesHubClient resources={resources} />
    </div>
  );
}
