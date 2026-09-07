"use client";

import { Source } from "@/lib/api";
import { formatSourceStats } from "@/lib/source-meta";
import { SourceStatusIcon, SourceTypeIcon } from "./source-icons";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface SourceItemProps {
  source: Source;
  onOpen: () => void;
  onDelete: () => void;
}

export function SourceItem({ source, onOpen, onDelete }: SourceItemProps) {
  return (
    <div className="group/source relative">
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground">
          <SourceTypeIcon type={source.type} className="size-3" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{source.title}</span>
          <span className="mt-px flex items-center gap-1">
            <SourceStatusIcon status={source.status} className="size-2.5 shrink-0" />
            <span className="truncate text-[10px] text-muted-foreground tnum">
              {formatSourceStats(source, true)}
            </span>
          </span>
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Delete ${source.title}`}
        onClick={onDelete}
        className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/source:opacity-100"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
