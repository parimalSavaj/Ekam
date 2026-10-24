"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useNotebooks } from "@/hooks/use-notebooks";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { pluralize } from "@/lib/format";
import {
  BookOpen,
  LayoutGrid,
  Moon,
  NotebookPen,
  Plus,
  Sun,
} from "lucide-react";

/**
 * Global Cmd/Ctrl+K palette. Jumps between notebooks and exposes the handful of
 * actions worth reaching without the mouse.
 *
 * `onCreateNotebook` is optional so the palette can be mounted on screens that
 * have no create affordance of their own (the notebook workspace); there it
 * routes to the dashboard instead.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onCreateNotebook,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNotebook?: () => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: notebooks = [] } = useNotebooks();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const isDark = resolvedTheme === "dark";

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a notebook or run an action"
      className="sm:max-w-lg"
    >
      <CommandInput placeholder="Search notebooks or run a command…" />
      <CommandList className="max-h-80">
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          {onCreateNotebook && (
            <CommandItem
              value="new notebook create"
              onSelect={() => run(onCreateNotebook)}
            >
              <Plus />
              New notebook
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem
            value="dashboard all notebooks home"
            onSelect={() => run(() => router.push("/dashboard"))}
          >
            <LayoutGrid />
            Go to dashboard
          </CommandItem>
          <CommandItem
            value="theme dark light appearance toggle"
            onSelect={() => run(() => setTheme(isDark ? "light" : "dark"))}
          >
            {isDark ? <Sun /> : <Moon />}
            Switch to {isDark ? "light" : "dark"} theme
          </CommandItem>
        </CommandGroup>

        {notebooks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notebooks">
              {notebooks.map((notebook) => (
                <CommandItem
                  key={notebook.id}
                  value={`${notebook.title} ${notebook.description ?? ""}`}
                  onSelect={() =>
                    run(() => router.push(`/notebook/${notebook.id}`))
                  }
                >
                  {notebook.emoji ? (
                    <span
                      aria-hidden="true"
                      className="flex size-4 items-center justify-center text-sm"
                    >
                      {notebook.emoji}
                    </span>
                  ) : (
                    <NotebookPen />
                  )}
                  <span className="truncate">{notebook.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tnum">
                    {pluralize(notebook.activeSourceCount, "source")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {notebooks.length === 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notebooks">
              <CommandItem disabled value="__empty">
                <BookOpen />
                No notebooks yet
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
