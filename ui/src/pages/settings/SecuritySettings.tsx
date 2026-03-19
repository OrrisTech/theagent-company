import { Shield } from "lucide-react";
import { PlaceholderPage } from "../../components/PlaceholderPage";

export function SecuritySettings() {
  return (
    <PlaceholderPage
      titleKey="pages.security.title"
      descriptionKey="pages.security.description"
      icon={Shield}
    />
  );
}
