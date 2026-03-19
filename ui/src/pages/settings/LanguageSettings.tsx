import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { LanguageSelector } from "../../components/LanguageSwitcher";

export function LanguageSettings() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{t("pages.languageSettings.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pages.languageSettings.description")}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium">{t("language.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("language.description")}</p>
              <div className="mt-3">
                <LanguageSelector />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
