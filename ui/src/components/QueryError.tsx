import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorProps {
  /** Error object from React Query. */
  error: Error | null;
  /** Callback to retry the query. */
  onRetry?: () => void;
  /** Optional custom message override. */
  message?: string;
  /** Whether to render in a compact style (inline) vs full-page centered. */
  compact?: boolean;
}

/**
 * Reusable error display component for failed React Query requests.
 * Shows a user-friendly message with an optional retry button.
 */
export function QueryError({ error, onRetry, message, compact }: QueryErrorProps) {
  const { t } = useTranslation();

  const displayMessage = message ?? t("common.errorLoadingData");

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">{displayMessage}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 px-2 text-destructive hover:text-destructive">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{displayMessage}</p>
      {error && process.env.NODE_ENV === "development" && (
        <p className="text-xs text-muted-foreground/70 max-w-md">{error.message}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
