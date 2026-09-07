"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { Notebook } from "@/lib/api";
import {
  useNotebooks,
  useCreateNotebook,
  useUpdateNotebook,
  useDeleteNotebook,
} from "@/hooks/use-notebooks";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageLoader } from "@/components/page-loader";
import { CommandPalette } from "@/components/command-palette";
import { absoluteDate, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  BookOpen,
  LogOut,
  Search,
  ArrowUpDown,
  LayoutGrid,
  Rows3,
  Check,
  X,
} from "lucide-react";

const DEFAULT_EMOJI = "📓";

type SortKey = "recent" | "name" | "sources";
type ViewMode = "grid" | "list";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Last opened",
  name: "Name",
  sources: "Source count",
};

type NotebookFormValues = { title: string; description: string; emoji: string };
const EMPTY_FORM: NotebookFormValues = { title: "", description: "", emoji: "" };

function sortNotebooks(list: Notebook[], sort: SortKey): Notebook[] {
  const copy = [...list];
  switch (sort) {
    case "name":
      return copy.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
    case "sources":
      return copy.sort((a, b) => b.activeSourceCount - a.activeSourceCount);
    case "recent":
    default:
      return copy.sort((a, b) => {
        const aTime = new Date(a.lastOpenedAt ?? a.updatedAt).getTime();
        const bTime = new Date(b.lastOpenedAt ?? b.updatedAt).getTime();
        return bTime - aTime;
      });
  }
}

export default function Dashboard() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const { data: notebooks = [], isLoading } = useNotebooks();
  const createMutation = useCreateNotebook();
  const updateMutation = useUpdateNotebook();
  const deleteMutation = useDeleteNotebook();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [deletingNotebook, setDeletingNotebook] = useState<Notebook | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  const handleCreate = (values: NotebookFormValues) => {
    createMutation.mutate(
      {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        emoji: values.emoji.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          toast.add({ title: "Notebook created", type: "success" });
        },
        onError: (err) => {
          toast.add({
            title: err instanceof Error ? err.message : "Failed to create notebook",
            type: "error",
          });
        },
      }
    );
  };

  const handleEditSubmit = (values: NotebookFormValues) => {
    if (!editingNotebook) return;
    updateMutation.mutate(
      {
        id: editingNotebook.id,
        data: {
          title: values.title.trim(),
          description: values.description.trim() || null,
          emoji: values.emoji.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setEditingNotebook(null);
          toast.add({ title: "Notebook updated", type: "success" });
        },
        onError: (err) => {
          toast.add({
            title: err instanceof Error ? err.message : "Failed to update notebook",
            type: "error",
          });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deletingNotebook) return;
    deleteMutation.mutate(deletingNotebook.id, {
      onSuccess: () => {
        setDeletingNotebook(null);
        toast.add({ title: "Notebook deleted", type: "success" });
      },
      onError: (err) => {
        setDeletingNotebook(null);
        toast.add({
          title: err instanceof Error ? err.message : "Failed to delete notebook",
          type: "error",
        });
      },
    });
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (isPending || !session) {
    return <PageLoader />;
  }

  const user = session.user;
  const initials =
    user.name
      ?.split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? notebooks.filter(
        (n) =>
          n.title.toLowerCase().includes(normalizedQuery) ||
          (n.description ?? "").toLowerCase().includes(normalizedQuery)
      )
    : notebooks;
  const visible = sortNotebooks(filtered, sort);
  const totalSources = notebooks.reduce((sum, n) => sum + n.activeSourceCount, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onCreateNotebook={() => setShowCreateDialog(true)}
      />

      {/* App header */}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
              <BookOpen className="size-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">NotebookLM</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              className="gap-2 pr-1.5 text-muted-foreground"
            >
              <Search />
              <span className="hidden sm:inline">Search</span>
              <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
            </Button>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" />}
                aria-label="Account menu"
              >
                <Avatar size="sm">
                  {user.image && <AvatarImage src={user.image} alt="" />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-7">
        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Notebooks</h1>
            <p className="mt-1 text-sm text-muted-foreground tnum">
              {isLoading
                ? "Loading…"
                : `${pluralize(notebooks.length, "notebook")} · ${pluralize(totalSources, "source")}`}
            </p>
          </div>
          <Button size="lg" onClick={() => setShowCreateDialog(true)}>
            <Plus />
            New notebook
          </Button>
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter notebooks…"
              aria-label="Filter notebooks"
              className="h-8 pl-8"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Clear filter"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
              >
                <X />
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
              className="text-muted-foreground"
            >
              <ArrowUpDown />
              <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => setSort(key)}>
                  {SORT_LABELS[key]}
                  {sort === key && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center rounded-lg border p-0.5">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-xs"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon-xs"
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <Rows3 />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-5">
          {isLoading ? (
            view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border bg-card p-4">
                    <Skeleton className="size-8 rounded-md" />
                    <Skeleton className="mt-3 h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-full" />
                    <Skeleton className="mt-4 h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b p-3 last:border-b-0"
                  >
                    <Skeleton className="size-7 rounded-md" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="ml-auto h-3 w-20" />
                  </div>
                ))}
              </div>
            )
          ) : notebooks.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-10 rounded-lg">
                  <BookOpen className="size-4.5" />
                </EmptyMedia>
                <EmptyTitle>No notebooks yet</EmptyTitle>
                <EmptyDescription>
                  A notebook holds your sources and the conversations grounded in
                  them. Create one to get started.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="lg" onClick={() => setShowCreateDialog(true)}>
                  <Plus />
                  New notebook
                </Button>
              </EmptyContent>
            </Empty>
          ) : visible.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-10 rounded-lg">
                  <Search className="size-4.5" />
                </EmptyMedia>
                <EmptyTitle>No matches</EmptyTitle>
                <EmptyDescription>
                  Nothing matches “{query}”. Try a different term.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="lg" onClick={() => setQuery("")}>
                  Clear filter
                </Button>
              </EmptyContent>
            </Empty>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((notebook) => (
                <NotebookGridCard
                  key={notebook.id}
                  notebook={notebook}
                  onOpen={() => router.push(`/notebook/${notebook.id}`)}
                  onRename={() => setEditingNotebook(notebook)}
                  onDelete={() => setDeletingNotebook(notebook)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              {/* Column headers */}
              <div className="hidden items-center gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:flex">
                <span className="flex-1">Name</span>
                <span className="w-20 text-right">Sources</span>
                <span className="hidden w-40 lg:block">Model</span>
                <span className="w-28 text-right">Last opened</span>
                <span className="w-7" />
              </div>

              {visible.map((notebook) => (
                <NotebookListRow
                  key={notebook.id}
                  notebook={notebook}
                  onOpen={() => router.push(`/notebook/${notebook.id}`)}
                  onRename={() => setEditingNotebook(notebook)}
                  onDelete={() => setDeletingNotebook(notebook)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create */}
      <NotebookFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        defaultValues={EMPTY_FORM}
        isPending={createMutation.isPending}
        onSubmit={handleCreate}
      />

      {/* Edit */}
      <NotebookFormDialog
        key={editingNotebook?.id ?? "edit"}
        open={editingNotebook !== null}
        onOpenChange={(open) => {
          if (!open) setEditingNotebook(null);
        }}
        mode="edit"
        defaultValues={{
          title: editingNotebook?.title ?? "",
          description: editingNotebook?.description ?? "",
          emoji: editingNotebook?.emoji ?? "",
        }}
        isPending={updateMutation.isPending}
        onSubmit={handleEditSubmit}
      />

      {/* Delete */}
      <AlertDialog
        open={deletingNotebook !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingNotebook(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notebook</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingNotebook?.title}” and all of its sources and conversations
              will be permanently removed. This can’t be undone.
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

function NotebookEmoji({
  emoji,
  className,
}: {
  emoji: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border bg-muted/60",
        className
      )}
    >
      {emoji || DEFAULT_EMOJI}
    </span>
  );
}

function RowActions({
  notebook,
  onRename,
  onDelete,
  className,
}: {
  notebook: Notebook;
  onRename: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" />}
        aria-label={`Actions for ${notebook.title}`}
        className={cn("text-muted-foreground", className)}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotebookGridCard({
  notebook,
  onOpen,
  onRename,
  onDelete,
}: {
  notebook: Notebook;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const lastOpened = notebook.lastOpenedAt ?? notebook.updatedAt;

  return (
    <div className="group relative flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      {/* Single tab stop for opening; the actions menu sits above it. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${notebook.title}`}
        className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      />

      <div className="flex items-start justify-between gap-2">
        <NotebookEmoji emoji={notebook.emoji} className="size-8 text-base" />
        <RowActions
          notebook={notebook}
          onRename={onRename}
          onDelete={onDelete}
          className="z-20 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
        />
      </div>

      <h2 className="mt-3 truncate text-sm font-medium">{notebook.title}</h2>
      <p className="mt-1 line-clamp-2 min-h-8 text-xs/relaxed text-muted-foreground">
        {notebook.description || "No description"}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground tnum">
        <span>{pluralize(notebook.activeSourceCount, "source")}</span>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-default truncate" />}>
            {relativeTime(lastOpened)}
          </TooltipTrigger>
          <TooltipContent>Last opened {absoluteDate(lastOpened)}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function NotebookListRow({
  notebook,
  onOpen,
  onRename,
  onDelete,
}: {
  notebook: Notebook;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const lastOpened = notebook.lastOpenedAt ?? notebook.updatedAt;

  return (
    <div className="group relative flex items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${notebook.title}`}
        className="absolute inset-0 z-10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <NotebookEmoji emoji={notebook.emoji} className="size-7 text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{notebook.title}</p>
          {notebook.description && (
            <p className="truncate text-xs text-muted-foreground sm:hidden">
              {notebook.description}
            </p>
          )}
        </div>
      </div>

      <span className="hidden w-20 text-right text-sm text-muted-foreground tnum sm:block">
        {notebook.activeSourceCount}
      </span>

      <span className="hidden w-40 truncate text-xs text-muted-foreground lg:block">
        {notebook.aiModel}
      </span>

      <span className="hidden w-28 text-right text-xs text-muted-foreground tnum sm:block">
        {relativeTime(lastOpened)}
      </span>

      <RowActions
        notebook={notebook}
        onRename={onRename}
        onDelete={onDelete}
        className="z-20 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
      />
    </div>
  );
}

function NotebookFormDialog({
  open,
  onOpenChange,
  mode,
  defaultValues,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  defaultValues: NotebookFormValues;
  isPending: boolean;
  onSubmit: (values: NotebookFormValues) => void;
}) {
  const [values, setValues] = useState(defaultValues);
  const isCreate = mode === "create";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title.trim()) return;
    onSubmit(values);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isCreate) setValues(defaultValues);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? "New notebook" : "Edit notebook"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Name your notebook. You can add sources once it exists."
              : "Update the name, description, or emoji."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="notebook-title">Title</Label>
            <div className="flex gap-2">
              <Input
                id="notebook-emoji"
                value={values.emoji}
                onChange={(e) => setValues((v) => ({ ...v, emoji: e.target.value }))}
                placeholder={DEFAULT_EMOJI}
                maxLength={4}
                aria-label="Emoji"
                className="h-9 w-12 shrink-0 px-0 text-center text-base"
              />
              <Input
                id="notebook-title"
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                placeholder="Thesis research"
                className="h-9"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notebook-description">
              Description
              <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Textarea
              id="notebook-description"
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              placeholder="What is this notebook for?"
              rows={2}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="lg" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || !values.title.trim()}
            >
              {isPending
                ? isCreate
                  ? "Creating…"
                  : "Saving…"
                : isCreate
                  ? "Create notebook"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
