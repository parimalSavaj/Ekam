"use client";

import { useSession } from "@/lib/auth-client";
import { useNotebook } from "@/hooks/use-notebooks";
import { useSources } from "@/hooks/use-sources";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { NotebookSidebar } from "@/components/notebook/notebook-sidebar";
import { ChatArea } from "@/components/notebook/chat-area";
import { AllSourcesView } from "@/components/notebook/all-sources-view";
import { SourceContentView } from "@/components/notebook/source-content-view";
import { AddSourceDialog } from "@/components/notebook/add-source-dialog";
import { SettingsPanel } from "@/components/notebook/settings-panel";
import { PageLoader } from "@/components/page-loader";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  FileStack,
  Search,
} from "lucide-react";

export type MainView = "chat" | "all-sources" | "source-content";

export default function NotebookDetailPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const params = useParams();
  const notebookId = params.id as string;

  const { data: notebook, isLoading } = useNotebook(notebookId);
  const { data: sources = [] } = useSources(notebookId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainView, setMainView] = useState<MainView>("chat");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const handleConversationChange = useCallback((convId: string | null) => {
    setSelectedConversationId(convId);
  }, []);

  const handleOpenSource = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
    setMainView("source-content");
  }, []);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  if (isPending || !session) {
    return <PageLoader />;
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (!notebook) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-base font-semibold tracking-tight">
            Notebook not found
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            It may have been deleted, or the link is incorrect.
          </p>
          <Button size="lg" className="mt-5" onClick={() => router.push("/dashboard")}>
            <ArrowLeft />
            Back to notebooks
          </Button>
        </div>
      </div>
    );
  }

  const isSourcesView = mainView === "all-sources" || mainView === "source-content";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-64 flex-shrink-0 flex-col border-r bg-sidebar">
          <NotebookSidebar
            notebook={notebook}
            notebookId={notebookId}
            activeConversationId={selectedConversationId}
            onViewAllSources={() => setMainView("all-sources")}
            onAddSource={() => setShowAddSource(true)}
            onOpenSource={handleOpenSource}
            onOpenSettings={() => setShowSettings(true)}
            onSelectConversation={(convId) => {
              setSelectedConversationId(convId);
              setMainView("chat");
            }}
            onNewChat={() => {
              setSelectedConversationId(null);
              setMainView("chat");
            }}
          />
        </aside>
      )}

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-shrink-0 items-center gap-1.5 border-b px-3">
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon-sm" />}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              className="text-muted-foreground"
            >
              {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
            </TooltipTrigger>
            <TooltipContent>
              {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            </TooltipContent>
          </Tooltip>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded px-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Notebooks
            </button>
            <span aria-hidden="true" className="text-muted-foreground/50">
              /
            </span>
            <span className="truncate px-1 text-sm font-medium">{notebook.title}</span>
          </nav>

          {/* View switcher */}
          <div className="mx-auto flex items-center gap-0.5 rounded-lg border p-0.5">
            <Button
              variant={mainView === "chat" ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={mainView === "chat"}
              onClick={() => setMainView("chat")}
              className="gap-1.5"
            >
              <MessageSquare />
              Chat
            </Button>
            <Button
              variant={isSourcesView ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={isSourcesView}
              onClick={() => setMainView("all-sources")}
              className="gap-1.5"
            >
              <FileStack />
              Sources
              {sources.length > 0 && (
                <span className="text-muted-foreground tnum">{sources.length}</span>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="ghost" size="icon-sm" />}
                onClick={() => setPaletteOpen(true)}
                aria-label="Search"
                className="text-muted-foreground"
              >
                <Search />
              </TooltipTrigger>
              <TooltipContent className="gap-1.5">
                Search <Kbd>⌘K</Kbd>
              </TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </header>

        <div className={cn("flex min-h-0 flex-1 flex-col")}>
          {mainView === "chat" && (
            <ChatArea
              notebookId={notebookId}
              notebook={notebook}
              initialConversationId={selectedConversationId}
              onConversationChange={handleConversationChange}
            />
          )}
          {mainView === "all-sources" && (
            <AllSourcesView
              notebookId={notebookId}
              onAddSource={() => setShowAddSource(true)}
              onOpenSource={handleOpenSource}
            />
          )}
          {mainView === "source-content" && selectedSourceId && (
            <SourceContentView
              notebookId={notebookId}
              sourceId={selectedSourceId}
              onBack={() => setMainView("all-sources")}
            />
          )}
        </div>
      </div>

      <AddSourceDialog
        notebookId={notebookId}
        open={showAddSource}
        onOpenChange={setShowAddSource}
      />

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notebook settings</DialogTitle>
            <DialogDescription>
              {pluralize(sources.length, "source")} · {notebook.aiModel}
            </DialogDescription>
          </DialogHeader>
          <SettingsPanel notebook={notebook} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
