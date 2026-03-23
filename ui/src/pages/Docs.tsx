import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { BookOpen, Rocket, Users, Workflow, Settings, Bot, Puzzle, Radio, HelpCircle } from "lucide-react";
import { Link } from "@/lib/router";

export function Docs() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: t("docs.title") }]);
  }, [setBreadcrumbs, t]);

  const sections = [
    {
      title: t("docs.gettingStarted"),
      description: t("docs.gettingStartedDesc"),
      icon: Rocket,
      links: [
        { label: t("docs.createCompany"), to: "/dashboard" },
        { label: t("docs.addAgent"), to: "/agents/all" },
        { label: t("docs.createProject"), to: "/projects" },
        { label: t("docs.assignTask"), to: "/dashboard" },
      ],
    },
    {
      title: t("docs.teamManagement"),
      description: t("docs.teamManagementDesc"),
      icon: Users,
      links: [
        { label: t("docs.addAgent"), to: "/agents/all" },
        { label: t("docs.setRoles"), to: "/agents/all" },
        { label: t("docs.monitorActivity"), to: "/inbox" },
        { label: t("docs.reviewPerformance"), to: "/performance" },
      ],
    },
    {
      title: t("docs.workflows"),
      description: t("docs.workflowsDesc"),
      icon: Workflow,
      links: [
        { label: t("docs.createWorkflow"), to: "/workflows" },
        { label: t("docs.triggerWorkflows"), to: "/workflows" },
        { label: t("docs.monitorRuns"), to: "/workflows" },
      ],
    },
    {
      title: t("docs.aiModels"),
      description: t("docs.aiModelsDesc"),
      icon: Bot,
      links: [
        { label: t("docs.addModelProviders"), to: "/settings/models" },
        { label: t("docs.setDefaultModels"), to: "/settings/models" },
      ],
    },
    {
      title: t("docs.channelsIntegrations"),
      description: t("docs.channelsIntegrationsDesc"),
      icon: Radio,
      links: [
        { label: t("docs.configureChannels"), to: "/settings/channels" },
        { label: t("docs.installSkills"), to: "/settings/skills" },
      ],
    },
    {
      title: t("docs.skillsPlugins"),
      description: t("docs.skillsPluginsDesc"),
      icon: Puzzle,
      links: [
        { label: t("docs.browseSkills"), to: "/settings/skills" },
        { label: t("docs.configureCron"), to: "/settings/cron" },
      ],
    },
    {
      title: t("docs.settingsTitle"),
      description: t("docs.settingsDesc"),
      icon: Settings,
      links: [
        { label: t("docs.securitySettings"), to: "/settings/security" },
        { label: t("settings.branding") || "Branding", to: "/settings/branding" },
        { label: t("sidebar.language") || "Language", to: "/settings/language" },
        { label: t("settings.general") || "General", to: "/company/settings" },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t("docs.title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("docs.description")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="rounded-lg border border-border p-5 space-y-3 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-semibold">{section.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{section.description}</p>
              <ul className="space-y-1">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-primary hover:underline"
                    >
                      {link.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-5 flex items-start gap-3">
        <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium mb-1">{t("docs.needHelp")}</h3>
          <p className="text-sm text-muted-foreground">{t("docs.needHelpDesc")}</p>
        </div>
      </div>
    </div>
  );
}
