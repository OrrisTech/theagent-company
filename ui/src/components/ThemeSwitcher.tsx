import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ThemePreference = "light" | "dark" | "system";

const OPTIONS: { value: ThemePreference; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
  { value: "system", icon: Monitor, labelKey: "theme.system" },
];

/**
 * Compact theme switcher button for the sidebar footer.
 * Cycles through light → dark → system on click.
 */
export function ThemeSwitcherButton() {
  const { preference, toggleTheme, theme } = useTheme();
  const { t } = useTranslation();

  const currentOption = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2]!;
  const Icon = theme === "dark" ? Moon : Sun;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={toggleTheme}
          aria-label={t("theme.switchTo", { mode: currentOption.labelKey })}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {t(currentOption.labelKey)}
        {preference === "system" && ` (${t(`theme.${theme}`)})`}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Full theme selector for settings pages.
 * Renders a button group for all theme options.
 */
export function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="flex gap-2">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = preference === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => setPreference(option.value)}
            aria-pressed={isActive}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {t(option.labelKey)}
          </Button>
        );
      })}
    </div>
  );
}
