import { Clock } from "lucide-react";
import { PlaceholderPage } from "../../components/PlaceholderPage";

export function CronSettings() {
  return (
    <PlaceholderPage
      titleKey="pages.cronHeartbeat.title"
      descriptionKey="pages.cronHeartbeat.description"
      icon={Clock}
    />
  );
}
