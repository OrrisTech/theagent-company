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
 * Renders a select dropdown to support many languages.
 */
export function LanguageSelector() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith("zh") ? "zh" : "en";

  return (
    <select
      value={currentLang}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
