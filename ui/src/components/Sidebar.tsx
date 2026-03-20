import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Settings,
  Users,
  Workflow,
  FileText,
  Brain,
  Link2,
  Bot,
  Radio,
  Puzzle,
  Clock,
  Palette,
  Globe,
  Shield,
  Bell,
  BarChart3,
  MessagesSquare,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";

export function Sidebar() {
  const { t } = useTranslation();
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: Company name + Search */}
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        {selectedCompany?.brandColor && (
          <div
            className="w-4 h-4 rounded-sm shrink-0 ml-1"
            style={{ backgroundColor: selectedCompany.brandColor }}
          />
        )}
        <span className="flex-1 text-sm font-bold text-foreground truncate pl-1">
          {selectedCompany?.name ?? t("common.selectCompany")}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        {/* Top actions */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("sidebar.newIssue")}</span>
          </button>
          <SidebarNavItem to="/dashboard" label={t("sidebar.overview")} icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label={t("sidebar.inbox")}
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        {/* Projects section */}
        <SidebarProjects />

        {/* Team section */}
        <SidebarSection label={t("sidebar.team")}>
          <SidebarNavItem to="/agents/all" label={t("sidebar.members")} icon={Users} />
          <SidebarNavItem to="/org" label={t("sidebar.orgChart")} icon={Network} />
        </SidebarSection>

        {/* Workflows */}
        <SidebarSection label={t("sidebar.work")}>
          <SidebarNavItem to="/workflows" label={t("sidebar.workflows")} icon={Workflow} />
          <SidebarNavItem to="/issues" label={t("sidebar.issues")} icon={CircleDot} />
          <SidebarNavItem to="/goals" label={t("sidebar.goals")} icon={Target} />
        </SidebarSection>

        {/* Operations */}
        <SidebarSection label={t("sidebar.company")}>
          <SidebarNavItem to="/usage-budget" label={t("sidebar.usageBudget")} icon={DollarSign} />
          <SidebarNavItem to="/documents" label={t("sidebar.documents")} icon={FileText} />
          <SidebarNavItem to="/memory" label={t("sidebar.memory")} icon={Brain} />
          <SidebarNavItem to="/collaboration" label={t("sidebar.collaboration")} icon={Link2} />
          <SidebarNavItem to="/notifications" label={t("sidebar.notifications")} icon={Bell} />
          <SidebarNavItem to="/performance" label={t("sidebar.performance")} icon={BarChart3} />
          <SidebarNavItem to="/team-collaboration" label={t("sidebar.teamCollab")} icon={MessagesSquare} />
          <SidebarNavItem to="/activity" label={t("sidebar.activity")} icon={History} />
        </SidebarSection>

        {/* Settings */}
        <SidebarSection label={t("sidebar.settings")}>
          <SidebarNavItem to="/settings/models" label={t("sidebar.models")} icon={Bot} />
          <SidebarNavItem to="/settings/channels" label={t("sidebar.channels")} icon={Radio} />
          <SidebarNavItem to="/settings/skills" label={t("sidebar.skills")} icon={Puzzle} />
          <SidebarNavItem to="/settings/cron" label={t("sidebar.cronHeartbeat")} icon={Clock} />
          <SidebarNavItem to="/settings/branding" label={t("sidebar.branding")} icon={Palette} />
          <SidebarNavItem to="/settings/language" label={t("sidebar.language")} icon={Globe} />
          <SidebarNavItem to="/settings/security" label={t("sidebar.security")} icon={Shield} />
          <SidebarNavItem to="/company/settings" label={t("settings.general")} icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
