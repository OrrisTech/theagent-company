import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

// Map internal status values to user-facing display labels
const STATUS_DISPLAY_LABELS: Record<string, string> = {
  terminated: "fired",
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_DISPLAY_LABELS[status] ?? status.replace("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {label}
    </span>
  );
}
