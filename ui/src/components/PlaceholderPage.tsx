import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  /** i18n key for the page title (e.g. "pages.workflows.title") */
  titleKey: string;
  /** i18n key for the page description (e.g. "pages.workflows.description") */
  descriptionKey: string;
  /** Optional icon to display */
  icon?: LucideIcon;
}

/**
 * Generic placeholder page for features that are planned but not yet implemented.
 * Displays a title, description, and "coming soon" indicator.
 */
export function PlaceholderPage({ titleKey, descriptionKey, icon: Icon }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {Icon ? (
            <Icon className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Construction className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <h1 className="text-xl font-semibold">{t(titleKey)}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t(descriptionKey)}</p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <Construction className="h-3 w-3" />
          {t("common.comingSoon")}
        </div>
      </div>
    </div>
  );
}
