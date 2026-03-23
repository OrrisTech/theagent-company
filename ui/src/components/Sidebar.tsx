import {
  Inbox,
  LayoutDashboard,
  DollarSign,
  Search,
  SquarePen,
  Settings,
  Users,
  Workflow,
  FileText,
  Brain,
  History,
  BarChart3,
  ChevronDown,
  Bot,
  Radio,
  Puzzle,
  Clock,
  Palette,
  Globe,
  Shield,
  LogOut,
  ChevronsUpDown,
  Plus,
  HelpCircle,
  User,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { ThemeSwitcherButton } from "./ThemeSwitcher";
import { useDialog } from "../context/DialogContext";
import { useColorScheme } from "../context/ColorSchemeContext";
import { useCompany } from "../context/CompanyContext";
import { heartbeatsApi } from "../api/heartbeats";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";
import { cn } from "@/lib/utils";
import { CompanyPatternIcon } from "./CompanyPatternIcon";

/* ── Language Menu ── */

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
] as const;

function LanguageMenu() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(
    (l) => i18n.language?.startsWith(l.code),
  ) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={() => setOpen(!open)}
      >
        <Globe className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-40 rounded-md border border-border bg-popover shadow-md py-1 z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                void i18n.changeLanguage(lang.code);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors",
                currentLang.code === lang.code && "bg-primary/10 text-primary",
              )}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Color Scheme Picker ── */

const SCHEME_DOTS: { scheme: import("../context/ColorSchemeContext").ColorScheme; color: string }[] = [
  { scheme: "amber", color: "oklch(0.65 0.18 55)" },
  { scheme: "mono", color: "oklch(0.55 0 0)" },
  { scheme: "blue", color: "oklch(0.55 0.18 250)" },
  { scheme: "rose", color: "oklch(0.58 0.20 350)" },
  { scheme: "emerald", color: "oklch(0.55 0.17 155)" },
  { scheme: "arctic", color: "oklch(0.60 0.12 210)" },
];

function ColorSchemePicker() {
  const { t } = useTranslation();
  const { scheme, setScheme } = useColorScheme();

  return (
    <div className="flex items-center gap-1" title={t("colorScheme.label")}>
      {SCHEME_DOTS.map((dot) => (
        <button
          key={dot.scheme}
          onClick={() => setScheme(dot.scheme)}
          title={t(`colorScheme.${dot.scheme}`)}
          className={cn(
            "h-3.5 w-3.5 rounded-full border transition-all",
            scheme === dot.scheme
              ? "border-foreground scale-110 ring-1 ring-foreground/30"
              : "border-transparent opacity-60 hover:opacity-100",
          )}
          style={{ backgroundColor: dot.color }}
        />
      ))}
    </div>
  );
}

/* ── Company Switcher ── */

function CompanySwitcher() {
  const { t } = useTranslation();
  const { companies, selectedCompany, setSelectedCompanyId } = useCompany();
  const { openOnboarding } = useDialog();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visibleCompanies = companies.filter((c) => c.status !== "archived");

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full min-w-0 hover:bg-accent/50 rounded-md px-1 py-0.5 transition-colors"
      >
        <img src="/favicon.svg" alt="TAC" className="w-5 h-5 rounded shrink-0" />
        {selectedCompany?.brandColor && (
          <CompanyPatternIcon
            companyName={selectedCompany.name}
            logoUrl={selectedCompany.logoUrl}
            brandColor={selectedCompany.brandColor}
            className="w-5 h-5 rounded-md shrink-0"
          />
        )}
        <span className="flex-1 text-sm font-bold text-foreground truncate text-left">
          {selectedCompany?.name ?? t("sidebar.theAgentCompany")}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full rounded-md border border-border bg-popover shadow-md py-1 z-50">
          {visibleCompanies.map((company) => (
            <button
              key={company.id}
              onClick={() => {
                setSelectedCompanyId(company.id);
                navigate(`/${company.issuePrefix}/dashboard`);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors",
                company.id === selectedCompany?.id && "bg-primary/10 text-primary",
              )}
            >
              <CompanyPatternIcon
                companyName={company.name}
                logoUrl={company.logoUrl}
                brandColor={company.brandColor}
                className="w-5 h-5 rounded-md shrink-0"
              />
              <span className="truncate">{company.name}</span>
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => {
                openOnboarding();
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>{t("user.newCompany")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Collapsible Section ── */

function CollapsibleSection({
  label,
  icon: Icon,
  childPaths,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  childPaths: string[];
  children: React.ReactNode;
}) {
  const location = useLocation();
  // pathname may be /COMPANYPREFIX/settings/models — strip the prefix segment
  const pathWithoutPrefix = "/" + location.pathname.split("/").slice(2).join("/");
  const isChildActive = childPaths.some(
    (path) => location.pathname.startsWith(path) || pathWithoutPrefix.startsWith(path),
  );
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => {
    if (isChildActive && !open) {
      setOpen(true);
    }
  }, [isChildActive]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full rounded-md"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="flex flex-col gap-0.5 ml-2">{children}</div>}
    </div>
  );
}

/* ── Main Sidebar ── */

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

  const { data: session } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => authApi.getSession(),
  });
  const isAuthenticated = !!session?.session;
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const userDisplay = userName || userEmail;
  const userInitial = userDisplay ? userDisplay.charAt(0).toUpperCase() : isAuthenticated ? "U" : "";

  const handleSignOut = async () => {
    await authApi.signOut();
    window.location.href = "/";
  };

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-56 h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top: Company switcher + Search */}
      <div className="flex items-center gap-1 px-2 h-12 shrink-0 border-b border-border/50">
        <CompanySwitcher />
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-0.5 px-2 py-2">
        {/* New Issue */}
        <button
          onClick={() => openNewIssue()}
          className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors rounded-md"
        >
          <SquarePen className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("sidebar.newIssue")}</span>
        </button>

        {/* Primary */}
        <SidebarNavItem to="/dashboard" label={t("sidebar.overview")} icon={LayoutDashboard} liveCount={liveRunCount} />
        <SidebarNavItem
          to="/inbox"
          label={t("sidebar.inbox")}
          icon={Inbox}
          badge={inboxBadge.inbox}
          badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
          alert={inboxBadge.failedRuns > 0}
        />
        <SidebarNavItem to="/workflows" label={t("sidebar.workflows")} icon={Workflow} />

        <PluginSlotOutlet
          slotTypes={["sidebar"]}
          context={pluginContext}
          className="flex flex-col gap-0.5"
          itemClassName="text-[13px] font-medium"
          missingBehavior="placeholder"
        />

        {/* Projects — expandable list */}
        <SidebarProjects />

        {/* Team */}
        <SidebarNavItem to="/agents/all" label={t("sidebar.members")} icon={Users} />

        {/* Company — collapsible */}
        <div className="mt-2 pt-2 border-t border-border/30">
          <CollapsibleSection
            label={t("sidebar.company") || "Company"}
            icon={BarChart3}
            childPaths={["/usage-budget", "/documents", "/memory", "/activity", "/performance"]}
          >
            <SidebarNavItem to="/usage-budget" label={t("sidebar.usageBudget")} icon={DollarSign} />
            <SidebarNavItem to="/activity" label={t("sidebar.activity")} icon={History} />
            <SidebarNavItem to="/performance" label={t("sidebar.performance")} icon={BarChart3} />
            <SidebarNavItem to="/documents" label={t("sidebar.documents")} icon={FileText} />
            <SidebarNavItem to="/memory" label={t("sidebar.memory")} icon={Brain} />
          </CollapsibleSection>
        </div>

        {/* Settings — collapsible */}
        <CollapsibleSection
          label={t("sidebar.settings") || "Settings"}
          icon={Settings}
          childPaths={["/settings", "/company/settings"]}
        >
          <SidebarNavItem to="/settings/models" label={t("sidebar.models")} icon={Bot} />
          <SidebarNavItem to="/settings/channels" label={t("sidebar.channels")} icon={Radio} />
          <SidebarNavItem to="/settings/skills" label={t("sidebar.skills")} icon={Puzzle} />
          <SidebarNavItem to="/settings/cron" label={t("sidebar.cronHeartbeat")} icon={Clock} />
          <SidebarNavItem to="/settings/security" label={t("sidebar.security")} icon={Shield} />
          <SidebarNavItem to="/settings/branding" label={t("sidebar.branding")} icon={Palette} />
          <SidebarNavItem to="/settings/language" label={t("sidebar.language")} icon={Globe} />
          <SidebarNavItem to="/company/settings" label={t("settings.general")} icon={Settings} />
        </CollapsibleSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3 mt-2"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>

      {/* Footer: User + controls */}
      <div className="border-t border-border px-2 py-2 space-y-1.5 shrink-0">
        {/* User row */}
        <div className="flex items-center gap-2 px-1">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {userInitial ? (
              <span className="text-[10px] font-bold text-primary">{userInitial}</span>
            ) : (
              <User className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {userName && <p className="text-xs font-medium text-foreground truncate">{userName}</p>}
            {userEmail && userName && (
              <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
            )}
            {userEmail && !userName && (
              <p className="text-xs text-foreground/80 truncate">{userEmail}</p>
            )}
            {!userDisplay && !isAuthenticated && <p className="text-xs text-muted-foreground">{t("user.notSignedIn")}</p>}
            {!userDisplay && isAuthenticated && <p className="text-xs text-muted-foreground">{t("user.signedIn")}</p>}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={handleSignOut} title={t("user.signOut")}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Controls row */}
        <div className="flex items-center gap-0.5 px-1">
          <ThemeSwitcherButton />
          <LanguageMenu />
          <ColorSchemePicker />
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" asChild>
            <Link to="/docs" title={t("user.help")}>
              <HelpCircle className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1" />
          <a href="/terms" className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors">{t("user.terms")}</a>
          <span className="text-[10px] text-muted-foreground/30">·</span>
          <a href="/privacy" className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors">{t("user.privacy")}</a>
        </div>
      </div>
    </aside>
  );
}
