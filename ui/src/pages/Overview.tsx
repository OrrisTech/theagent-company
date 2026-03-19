import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "../components/PlaceholderPage";

export function Overview() {
  return (
    <PlaceholderPage
      titleKey="pages.overview.title"
      descriptionKey="pages.overview.description"
      icon={LayoutDashboard}
    />
  );
}
