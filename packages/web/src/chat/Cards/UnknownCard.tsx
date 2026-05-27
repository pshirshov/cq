/**
 * UnknownCard.tsx — placeholder card for SDK event types not yet handled.
 *
 * Renders a collapsible <details> block showing the raw SDK event as
 * formatted JSON. PR-23 will replace calls to this component with proper
 * cards for Read / Write / Edit / Bash tool events.
 *
 * D26: Summary label rules
 *   - type "system"         → "system: <subtype>"
 *   - type "user"           → "user / tool result"
 *   - type "result"         → "result: <subtype>"
 *   - type "rate_limit_event" → "rate limit: <status|subtype>" or "rate limit"
 *   - other types with underscores → replace underscores with spaces
 *   - "SDK event:" prefix dropped everywhere
 */

export interface UnknownCardProps {
  sdkEvent: Record<string, unknown>;
}

function buildLabel(sdkEvent: Record<string, unknown>): string {
  const type = typeof sdkEvent["type"] === "string" ? sdkEvent["type"] : "unknown";
  const subtype = typeof sdkEvent["subtype"] === "string" ? sdkEvent["subtype"] : undefined;

  if (type === "system") {
    return subtype !== undefined ? `system: ${subtype}` : "system";
  }
  if (type === "user") {
    return "user / tool result";
  }
  if (type === "result") {
    return subtype !== undefined ? `result: ${subtype}` : "result";
  }
  if (type === "rate_limit_event") {
    const qualifier =
      typeof sdkEvent["status"] === "string"
        ? sdkEvent["status"]
        : subtype !== undefined
          ? subtype
          : undefined;
    return qualifier !== undefined ? `rate limit: ${qualifier}` : "rate limit";
  }
  // Default: humanize by replacing underscores with spaces.
  return type.replace(/_/g, " ");
}

export function UnknownCard({ sdkEvent }: UnknownCardProps): React.ReactElement {
  const label = buildLabel(sdkEvent);

  return (
    <details>
      <summary>{label}</summary>
      <pre>{JSON.stringify(sdkEvent, null, 2)}</pre>
    </details>
  );
}
