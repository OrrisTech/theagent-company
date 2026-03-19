import { DollarSign } from "lucide-react";
import { PlaceholderPage } from "../components/PlaceholderPage";

export function UsageBudget() {
  return (
    <PlaceholderPage
      titleKey="pages.usageBudget.title"
      descriptionKey="pages.usageBudget.description"
      icon={DollarSign}
    />
  );
}
