import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
] as const;

/**
 * Compact language switcher button for the sidebar footer.
 * Cycles through en → zh → en on click.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const currentLang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const nextLang = LANGUAGES.find((l) => l.code !== currentLang) ?? LANGUAGES[0];

  function handleSwitch() {
    void i18n.changeLanguage(nextLang.code);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={handleSwitch}
          aria-label={`Switch language to ${nextLang.label}`}
        >
          <Globe className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{nextLang.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Full language selector for settings pages.
 * Renders a button group for all supported languages.
 */
export function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language?.startsWith("zh") ? "zh" : "en";

  return (
    <div className="flex gap-2">
      {LANGUAGES.map((lang) => (
        <Button
          key={lang.code}
          type="button"
          variant={currentLang === lang.code ? "default" : "outline"}
          size="sm"
          onClick={() => void i18n.changeLanguage(lang.code)}
          aria-pressed={currentLang === lang.code}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  );
}
