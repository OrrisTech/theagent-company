import { FileText } from "lucide-react";
import { PlaceholderPage } from "../components/PlaceholderPage";

export function Documents() {
  return (
    <PlaceholderPage
      titleKey="pages.documents.title"
      descriptionKey="pages.documents.description"
      icon={FileText}
    />
  );
}
