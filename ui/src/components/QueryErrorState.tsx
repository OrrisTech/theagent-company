import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

interface QueryErrorStateProps {
  onRetry?: () => void;
  message?: string;
}

/**
 * Reusable empty/error state for pages where API calls fail.
 * Shows a friendly message with optional retry button.
 */
export function QueryErrorState({ onRetry, message }: QueryErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        {message ?? t("common.errorLoadingData", "Failed to load data")}
      </p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {t("common.retry", "Retry")}
        </Button>
      )}
    </div>
  );
}
