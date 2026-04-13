import type { EventType } from "@/lib/types/event";
import { getPlaybookForEventType } from "@/lib/event-playbooks";

interface EventChecklistProps {
  eventType: EventType;
}

export function EventChecklist({ eventType }: EventChecklistProps) {
  const steps = getPlaybookForEventType(eventType);

  return (
    <ol className="list-decimal space-y-3 pl-5 text-sm text-text-primary">
      {steps.map((step) => (
        <li key={step.id} className="marker:font-medium">
          <span className="font-medium">{step.label}</span>
          {step.description && (
            <p className="mt-0.5 text-text-secondary font-normal">{step.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
