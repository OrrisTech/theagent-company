import { useState } from "react";
import { useNavigate } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { useDialog } from "../context/DialogContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "tac.onboarding.dismissed";

interface OnboardingChecklistProps {
  hasCompany: boolean;
  agentsCount: number;
  projectsCount: number;
  issuesCount: number;
  activityCount: number;
}

export function OnboardingChecklist({
  hasCompany,
  agentsCount,
  projectsCount,
  issuesCount,
  activityCount,
}: OnboardingChecklistProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true",
  );
  const navigate = useNavigate();
  const { openNewIssue, openNewProject } = useDialog();

  if (dismissed) return null;

  const items = [
    {
      label: t("onboarding.createCompany"),
      checked: hasCompany,
      onClick: () => {},
    },
    {
      label: t("onboarding.addAgent"),
      checked: agentsCount > 0,
      onClick: () => navigate("/agents/all"),
    },
    {
      label: t("onboarding.createProject"),
      checked: projectsCount > 0,
      onClick: () => openNewProject(),
    },
    {
      label: t("onboarding.createTask"),
      checked: issuesCount > 0,
      onClick: () => openNewIssue(),
    },
    {
      label: t("onboarding.watchAgent"),
      checked: activityCount > 0,
      onClick: () => navigate("/inbox"),
    },
  ];

  const completed = items.filter((i) => i.checked).length;
  const total = items.length;

  if (completed === total) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  return (
    <Card>
      <CardHeader className="relative">
        <CardTitle className="text-base">
          🚀 {t("onboarding.title")}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-4 top-4 text-muted-foreground"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 mt-1">
          <Progress value={completed} max={total} className="flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">
            {completed}/{total} {t("onboarding.complete")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.checked}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left w-full",
              item.checked
                ? "text-muted-foreground"
                : "hover:bg-accent/50 text-foreground cursor-pointer",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full shrink-0 border",
                item.checked
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border",
              )}
            >
              {item.checked && <Check className="h-3 w-3" />}
            </span>
            <span className={cn("flex-1", item.checked && "line-through")}>
              {item.label}
            </span>
            {!item.checked && (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
