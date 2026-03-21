import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Search,
  FolderOpen,
  ArrowLeft,
  Save,
  Pencil,
  HardDrive,
  Clock,
} from "lucide-react";
import type { OpenClawDocument } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { openclawApi } from "../api/openclaw";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

/** Format bytes to human-readable size */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function Documents() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Fetch documents list
  const { data: documents, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.openclaw.documents,
    queryFn: () => openclawApi.documents(),
    retry: 1,
  });

  // Fetch selected document content
  const { data: docContent, isLoading: contentLoading } = useQuery({
    queryKey: queryKeys.openclaw.documentContent(selectedDoc ?? ""),
    queryFn: () => openclawApi.documentContent(selectedDoc!),
    enabled: !!selectedDoc,
    retry: 1,
  });

  // Save document mutation
  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      openclawApi.documentWrite(path, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.documents });
      if (selectedDoc) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.openclaw.documentContent(selectedDoc),
        });
      }
      setIsEditing(false);
    },
  });

  // Extract unique categories from documents
  const categories = useMemo(() => {
    if (!documents) return [];
    const cats = new Set<string>();
    for (const doc of documents) {
      cats.add(doc.category ?? "");
    }
    return Array.from(cats).sort();
  }, [documents]);

  // Filter documents
  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    return documents.filter((doc) => {
      const matchesSearch =
        !searchQuery ||
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.relativePath.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === null ||
        (categoryFilter === "" ? !doc.category : doc.category === categoryFilter);
      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, categoryFilter]);

  // Group by category for display
  const grouped = useMemo(() => {
    const groups = new Map<string, OpenClawDocument[]>();
    for (const doc of filteredDocs) {
      const cat = doc.category ?? "";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(doc);
    }
    return groups;
  }, [filteredDocs]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">{t("documents.title")}</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("common.errorLoadingData", "Failed to load data")}</p>
          <button onClick={() => refetch()} className="text-sm text-primary underline">{t("common.retry", "Retry")}</button>
        </div>
      </div>
    );
  }

  // Document viewer/editor
  if (selectedDoc) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedDoc(null);
              setIsEditing(false);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("common.back")}
          </Button>
          <span className="text-sm text-muted-foreground font-mono">{selectedDoc}</span>
          <div className="flex-1" />
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditContent(docContent?.content ?? "");
                setIsEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {t("documents.editDocument")}
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate({ path: selectedDoc, content: editContent })
                }
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saveMutation.isPending ? t("common.saving") : t("documents.saveDocument")}
              </Button>
            </div>
          )}
        </div>

        <Card className="rounded-lg">
          <CardContent>
            {contentLoading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : isEditing ? (
              <textarea
                className="w-full min-h-[400px] rounded-md border bg-background p-4 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            ) : (
              <pre className="max-h-[600px] overflow-auto rounded-md bg-muted p-4 text-sm font-mono whitespace-pre-wrap">
                {docContent?.content ?? ""}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{t("documents.title")}</h1>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("documents.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {categories.length > 1 && (
          <div className="flex gap-1">
            <Button
              variant={categoryFilter === null ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCategoryFilter(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat || t("documents.uncategorized")}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Document list */}
      {filteredDocs.length === 0 ? (
        <Card className="rounded-lg">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {documents?.length === 0 ? t("documents.noDocuments") : t("common.noData")}
              </p>
              {documents?.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("documents.noDocumentsHint")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, docs]) => (
            <Card key={category} className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="h-4 w-4" />
                  {category || t("documents.uncategorized")}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({docs.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {docs.map((doc) => (
                    <button
                      key={doc.relativePath}
                      onClick={() => setSelectedDoc(doc.relativePath)}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{doc.filename}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {doc.relativePath}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {formatBytes(doc.sizeBytes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(doc.modifiedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No workspace notice */}
      {documents?.length === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 p-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {t("documents.noWorkspace")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("documents.noWorkspaceHint")}
          </p>
        </div>
      )}
    </div>
  );
}
