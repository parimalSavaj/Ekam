"use client";

import { useState } from "react";
import { useSources, useDeleteSource } from "@/hooks/use-sources";
import { Source } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { formatSourceStats, sourceTypeLabels } from "@/lib/source-meta";
import { SourceStatusIcon, SourceTypeIcon } from "./source-icons";
import { absoluteDate, formatBytes, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  FileStack,
  Search,
  X,
  Filter,
  Check,
  MoreHorizontal,
} from "lucide-react";

interface AllSourcesViewProps {
  notebookId: string;
  onAddSource: () => void;
  onOpenSource: (sourceId: string) => void;
}

type TypeFilter = "all" | Source["type"];
type StatusFilter = "all" | Source["status"];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "pdf", label: sourceTypeLabels.pdf },
  { value: "url", label: sourceTypeLabels.url },
  { value: "youtube", label: sourceTypeLabels.youtube },
  { value: "text", label: sourceTypeLabels.text },
  { value: "markdown", label: sourceTypeLabels.markdown },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  { value: "completed", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

export function AllSourcesView({
  notebookId,
  onAddSource,
  onOpenSource,
}: AllSourcesViewProps) {
  const { data: sources = [], isLoading } = useSources(notebookId);
  const deleteMutation = useDeleteSource(notebookId);
  const [deletingSource, setDeletingSource] = useState<Source | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const handleDelete = () => {
    if (!deletingSource) return;
    deleteMutation.mutate(deletingSource.id, {
      onSuccess: () => {
        setDeletingSource(null);
        toast.add({ title: "Source deleted", type: "success" });
      },
      onError: (err) => {
        setDeletingSource(null);
        toast.add({
          title: err instanceof Error ? err.message : "Failed to delete source",
          type: "error",
        });
      },
    });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visible = sources.filter((source) => {
    if (typeFilter !== "all" && source.type !== typeFilter) return false;
    if (statusFilter !== "all" && source.status !== statusFilter) return false;
    if (normalizedQuery && !source.title.toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    return true;
  });

  const hasFilters =
    normalizedQuery !== "" || typeFilter !== "all" || statusFilter !== "all";
  const readyCount = sources.filter((s) => s.status === "completed").length;
  const totalChunks = sources.reduce((sum, s) => sum + s.chunkCount, 0);

  const clearFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        {/* Heading */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Sources</h2>
            <p className="mt-1 text-sm text-muted-foreground tnum">
              {isLoading
                ? "Loading…"
                : `${pluralize(sources.length, "source")} · ${readyCount} ready · ${pluralize(totalChunks, "chunk")}`}
            </p>
          </div>
          <Button size="lg" onClick={onAddSource}>
            <Plus />
            Add source
          </Button>
        </div>

        {/* Toolbar */}
        {sources.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1 sm:max-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by title…"
                aria-label="Filter sources"
                className="h-8 pl-8"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                >
                  <X />
                </Button>
              )}
            </div>

            <FilterMenu
              label={TYPE_FILTERS.find((f) => f.value === typeFilter)?.label ?? "Type"}
              heading="Type"
              active={typeFilter !== "all"}
              options={TYPE_FILTERS}
              value={typeFilter}
              onChange={setTypeFilter}
            />

            <FilterMenu
              label={
                STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "Status"
              }
              heading="Status"
              active={statusFilter !== "all"}
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={setStatusFilter}
            />

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                Clear
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground tnum">
              {visible.length} of {sources.length}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="mt-4">
          {isLoading ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b p-3 last:border-b-0"
                >
                  <Skeleton className="size-8 rounded-md" />
                  <div className="flex-1">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="mt-1.5 h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : sources.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-10 rounded-lg">
                  <FileStack className="size-4.5" />
                </EmptyMedia>
                <EmptyTitle>No sources yet</EmptyTitle>
                <EmptyDescription>
                  Add a PDF, web page, YouTube video, or your own notes. Each one is
                  split into chunks and indexed so answers can cite it.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="lg" onClick={onAddSource}>
                  <Plus />
                  Add source
                </Button>
              </EmptyContent>
            </Empty>
          ) : visible.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-10 rounded-lg">
                  <Search className="size-4.5" />
                </EmptyMedia>
                <EmptyTitle>No matching sources</EmptyTitle>
                <EmptyDescription>
                  Nothing matches the current filters.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="lg" onClick={clearFilters}>
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              {visible.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  onOpen={() => onOpenSource(source.id)}
                  onDelete={() => setDeletingSource(source)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingSource !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingSource(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete source</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingSource?.title}” and its indexed chunks will be removed from
              this notebook. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterMenu<T extends string>({
  label,
  heading,
  active,
  options,
  value,
  onChange,
}: {
  label: string;
  heading: string;
  active: boolean;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        className={cn(!active && "text-muted-foreground")}
      >
        <Filter />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel>{heading}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            {option.label}
            {value === option.value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SourceRow({
  source,
  onOpen,
  onDelete,
}: {
  source: Source;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${source.title}`}
        className="absolute inset-0 z-10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      />

      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
        <SourceTypeIcon type={source.type} className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{source.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <SourceStatusIcon status={source.status} className="size-3 shrink-0" />
          <span className="truncate tnum">{formatSourceStats(source)}</span>
        </p>
      </div>

      <span className="hidden w-20 shrink-0 text-xs text-muted-foreground md:block">
        {sourceTypeLabels[source.type] ?? source.type}
      </span>

      <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground tnum lg:block">
        {formatBytes(source.fileSize)}
      </span>

      <Tooltip>
        <TooltipTrigger
          render={
            <span className="hidden w-24 shrink-0 cursor-default text-right text-xs text-muted-foreground tnum sm:block" />
          }
        >
          {relativeTime(source.createdAt)}
        </TooltipTrigger>
        <TooltipContent>Added {absoluteDate(source.createdAt)}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" />}
          aria-label={`Actions for ${source.title}`}
          className="z-20 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
