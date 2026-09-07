"use client";

import { Notebook } from "@/lib/api";
import { useSources, useDeleteSource } from "@/hooks/use-sources";
import { useConversations, useDeleteConversation } from "@/hooks/use-conversations";
import { toast } from "@/components/ui/toast";
import { SourceItem } from "./source-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Settings, ChevronRight, Trash2 } from "lucide-react";

const MAX_VISIBLE_SOURCES = 5;
const MAX_VISIBLE_CONVERSATIONS = 8;

interface NotebookSidebarProps {
  notebook: Notebook;
  notebookId: string;
  activeConversationId: string | null;
  onViewAllSources: () => void;
  onAddSource: () => void;
  onOpenSource: (sourceId: string) => void;
  onOpenSettings: () => void;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
}

export function NotebookSidebar({
  notebook,
  notebookId,
  activeConversationId,
  onViewAllSources,
  onAddSource,
  onOpenSource,
  onOpenSettings,
  onSelectConversation,
  onNewChat,
}: NotebookSidebarProps) {
  const { data: sources = [], isLoading: sourcesLoading } = useSources(notebookId);
  const { data: conversations = [], isLoading: conversationsLoading } =
    useConversations(notebookId);
  const deleteMutation = useDeleteSource(notebookId);
  const deleteConversationMutation = useDeleteConversation(notebookId);

  const visibleSources = sources.slice(0, MAX_VISIBLE_SOURCES);
  const hasMoreSources = sources.length > MAX_VISIBLE_SOURCES;
  const visibleConversations = conversations.slice(0, MAX_VISIBLE_CONVERSATIONS);
  const readyCount = sources.filter((s) => s.status === "completed").length;
  const processingCount = sources.filter(
    (s) => s.status === "pending" || s.status === "processing"
  ).length;

  const handleDeleteSource = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.add({ title: "Source deleted", type: "success" });
      },
      onError: (err) => {
        toast.add({
          title: err instanceof Error ? err.message : "Failed to delete source",
          type: "error",
        });
      },
    });
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversationMutation.mutate(id, {
      onSuccess: () => {
        if (activeConversationId === id) {
          onNewChat();
        }
        toast.add({ title: "Conversation deleted", type: "success" });
      },
      onError: (err) => {
        toast.add({
          title: err instanceof Error ? err.message : "Failed to delete conversation",
          type: "error",
        });
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Notebook identity */}
      <div className="flex items-start gap-2.5 border-b px-3 py-3">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-sm"
        >
          {notebook.emoji || "📓"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{notebook.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground tnum">
            {processingCount > 0
              ? `${readyCount} ready · ${processingCount} processing`
              : pluralize(readyCount, "source")}
          </p>
        </div>
      </div>

      {/* Sources */}
      <div className="flex flex-col px-2 pt-3">
        <SectionHeader
          label="Sources"
          count={sources.length}
          actionLabel="Add source"
          onAction={onAddSource}
        />

        {sourcesLoading ? (
          <div className="space-y-1 px-1">
            <Skeleton className="h-11 rounded-md" />
            <Skeleton className="h-11 rounded-md" />
          </div>
        ) : sources.length === 0 ? (
          <button
            onClick={onAddSource}
            className="mx-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2.5 text-xs text-muted-foreground transition-colors outline-none hover:border-foreground/25 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-3.5" />
            Add your first source
          </button>
        ) : (
          <>
            <div className="space-y-px">
              {visibleSources.map((source) => (
                <SourceItem
                  key={source.id}
                  source={source}
                  onOpen={() => onOpenSource(source.id)}
                  onDelete={() => handleDeleteSource(source.id)}
                />
              ))}
            </div>

            {hasMoreSources && (
              <button
                onClick={onViewAllSources}
                className="mt-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                View all {sources.length}
                <ChevronRight className="size-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Chats */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col px-2">
        <SectionHeader
          label="Chats"
          count={conversations.length}
          actionLabel="New chat"
          onAction={onNewChat}
        />

        {conversationsLoading ? (
          <div className="space-y-1 px-1">
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No chats yet.
          </p>
        ) : (
          <div className="no-scrollbar min-h-0 flex-1 space-y-px overflow-y-auto pb-2">
            {visibleConversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              return (
                <div key={conv.id} className="group/conv relative">
                  <button
                    onClick={() => onSelectConversation(conv.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "w-full rounded-md py-1.5 pr-8 pl-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60"
                    )}
                  >
                    <span className="block truncate text-xs font-medium">
                      {conv.title || "Untitled chat"}
                    </span>
                    <span className="mt-px block truncate text-[10px] text-muted-foreground tnum">
                      {conv.messageCount} · {relativeTime(conv.updatedAt)}
                    </span>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${conv.title || "untitled chat"}`}
                    onClick={() => handleDeleteConversation(conv.id)}
                    className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/conv:opacity-100"
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-2">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Settings className="size-3.5" />
          Settings
        </button>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  count,
  actionLabel,
  onAction,
}: {
  label: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex h-6 items-center justify-between gap-2 px-2">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {label}
        {count > 0 && <span className="ml-1.5 tnum opacity-60">{count}</span>}
      </span>

      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon-xs" />}
          onClick={onAction}
          aria-label={actionLabel}
          className="-mr-1 text-muted-foreground"
        >
          <Plus />
        </TooltipTrigger>
        <TooltipContent>{actionLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
