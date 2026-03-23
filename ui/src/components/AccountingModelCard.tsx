import { Database, Gauge, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const SURFACE_KEYS = [
  { titleKey: "accountingModelCard.inferenceLedger", descKey: "accountingModelCard.inferenceLedgerDescription", icon: Database, tone: "from-sky-500/12 via-sky-500/6 to-transparent", pointKeys: ["accountingModelCard.inferenceLedgerPoint1", "accountingModelCard.inferenceLedgerPoint2", "accountingModelCard.inferenceLedgerPoint3"] },
  { titleKey: "accountingModelCard.financeLedger", descKey: "accountingModelCard.financeLedgerDescription", icon: ReceiptText, tone: "from-amber-500/14 via-amber-500/6 to-transparent", pointKeys: ["accountingModelCard.financeLedgerPoints", "accountingModelCard.financeLedgerPoints2", "accountingModelCard.financeLedgerPoints3"] },
  { titleKey: "accountingModelCard.liveQuotas", descKey: "accountingModelCard.liveQuotasDescription", icon: Gauge, tone: "from-emerald-500/14 via-emerald-500/6 to-transparent", pointKeys: ["accountingModelCard.liveQuotasPoint1", "accountingModelCard.liveQuotasPoint2", "accountingModelCard.liveQuotasPoint3"] },
] as const;

export function AccountingModelCard() {
  const { t } = useTranslation();
  return (
    <Card className="relative overflow-hidden border-border/70">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_32%)]" />
      <CardHeader className="relative px-5 pt-5 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {t("accountingModelCard.accountingModel")}
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-6">
          {t("accountingModelCard.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative grid gap-3 px-5 pb-5 md:grid-cols-3">
        {SURFACE_KEYS.map((surface) => {
          const Icon = surface.icon;
          return (
            <div
              key={surface.titleKey}
              className={`rounded-2xl border border-border/70 bg-gradient-to-br ${surface.tone} p-4 shadow-sm`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t(surface.titleKey)}</div>
                  <div className="text-xs text-muted-foreground">{t(surface.descKey)}</div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {surface.pointKeys.map((pointKey) => (
                  <div key={pointKey}>{t(pointKey)}</div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
