import { Brain } from "lucide-react";
import { PlaceholderPage } from "../components/PlaceholderPage";

export function Memory() {
  return (
    <PlaceholderPage
      titleKey="pages.memory.title"
      descriptionKey="pages.memory.description"
      icon={Brain}
    />
  );
}
