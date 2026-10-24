"use client";

import { useState, useRef, useEffect } from "react";
import { Notebook, ChatSource, WebSearchResult } from "@/lib/api";
import { useSources } from "@/hooks/use-sources";
import { useChat, ChatMessage, ChatPhase } from "@/hooks/use-chat";
import { useConversations, useDeleteConversation } from "@/hooks/use-conversations";
import { pluralize, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import { toast } from "@/components/ui/toast";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Send,
  Square,
  Sparkles,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  Globe,
  ExternalLink,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";

const SUGGESTED_PROMPTS = [
  "Summarise the key points",
  "What are the main themes?",
  "What's missing or contradictory?",
];

interface ChatAreaProps {
  notebookId: string;
  notebook: Notebook;
  initialConversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
}

export function ChatArea({
  notebookId,
  notebook,
  initialConversationId,
  onConversationChange,
}: ChatAreaProps) {
  const { data: sources = [] } = useSources(notebookId);
  const {
    messages,
    conversationId,
    isStreaming,
    sendMessage,
    stopStreaming,
    loadConversation,
    startNewConversation,
  } = useChat(notebookId);

  const { data: conversations = [], refetch: refetchConversations } =
    useConversations(notebookId);
  const deleteConversation = useDeleteConversation(notebookId);

  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastLoadedConvRef = useRef<string | null>(null);
  const skipNextLoadRef = useRef(false);

  const completedSources = sources.filter((s) => s.status === "completed");
  const hasSources = completedSources.length > 0;

  // Load conversation when initialConversationId changes (clicked from sidebar)
  useEffect(() => {
    // Skip if this change was triggered by our own conversationId sync
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      lastLoadedConvRef.current = initialConversationId ?? null;
      return;
    }

    if (initialConversationId && initialConversationId !== lastLoadedConvRef.current) {
      lastLoadedConvRef.current = initialConversationId;
      loadConversation(initialConversationId);
    } else if (initialConversationId === null && lastLoadedConvRef.current !== null) {
      lastLoadedConvRef.current = null;
      startNewConversation();
    }
  }, [initialConversationId, loadConversation, startNewConversation]);

  // Sync conversationId back to parent when it changes (from sending first message)
  useEffect(() => {
    // Only skip the next load if conversation was just created (went from null to a value)
    if (conversationId !== null && conversationId !== lastLoadedConvRef.current) {
      skipNextLoadRef.current = true;
      lastLoadedConvRef.current = conversationId;
    }
    onConversationChange?.(conversationId);
  }, [conversationId, onConversationChange]);

  /**
   * Track whether the user is parked at the bottom. Anything further up means
   * they're reading back, so streaming shouldn't drag them down.
   */
  const handleMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  /*
   * Scroll the message container itself rather than calling scrollIntoView on a
   * sentinel. scrollIntoView walks up and scrolls *every* scrollable ancestor,
   * the document included, which pulls the whole app past the header and leaves
   * a blank gap below the composer. Setting scrollTop can only ever move this
   * one element.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Refetch conversations when a conversation completes
  useEffect(() => {
    if (!isStreaming && conversationId) {
      refetchConversations();
    }
  }, [isStreaming, conversationId, refetchConversations]);

  const handleSend = () => {
    if (!input.trim() || !hasSources || isStreaming) return;
    // Sending is an explicit intent to see the reply, so re-anchor to the bottom.
    stickToBottomRef.current = true;
    sendMessage(input);
    setInput("");
  };

  const handleConversationClick = (convId: string) => {
    loadConversation(convId);
    setShowHistory(false);
  };

  const handleDeleteConversation = (convId: string) => {
    deleteConversation.mutate(convId);
    if (conversationId === convId) {
      startNewConversation();
    }
  };

  const composer = (
    <Composer
      input={input}
      setInput={setInput}
      hasSources={hasSources}
      isStreaming={isStreaming}
      model={notebook.aiModel}
      sourceCount={completedSources.length}
      onSend={handleSend}
      onStop={stopStreaming}
    />
  );

  // Empty state — no messages yet
  if (messages.length === 0 && !showHistory) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-8">
          {!hasSources ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-10 rounded-lg">
                  <FileText className="size-4.5" />
                </EmptyMedia>
                <EmptyTitle>Add a source to begin</EmptyTitle>
                <EmptyDescription>
                  Answers here are drawn only from material you add. Once a source
                  finishes processing, you can start asking questions.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-10 rounded-lg">
                  <Sparkles className="size-4.5" />
                </EmptyMedia>
                <EmptyTitle>Ask about your sources</EmptyTitle>
                <EmptyDescription>
                  {pluralize(completedSources.length, "source")} indexed. Every answer
                  cites the passages it drew from.
                </EmptyDescription>
              </EmptyHeader>

              <EmptyContent className="max-w-lg">
                <div className="grid w-full gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none hover:border-foreground/20 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="truncate text-foreground/80">{prompt}</span>
                      <ArrowLeft className="size-3.5 shrink-0 rotate-180 text-muted-foreground" />
                    </button>
                  ))}
                </div>

                {conversations.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-muted-foreground"
                    onClick={() => setShowHistory(true)}
                  >
                    <MessageSquare />
                    {pluralize(conversations.length, "earlier chat")}
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          )}
        </div>

        {composer}
      </div>
    );
  }

  // Conversation history
  if (showHistory) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">Chats</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(false)}
                className="text-muted-foreground"
              >
                <ArrowLeft />
                Back
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              <button
                onClick={() => {
                  startNewConversation();
                  setShowHistory(false);
                }}
                className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Plus className="size-3.5" />
                New chat
              </button>

              {conversations.map((conv) => (
                <div key={conv.id} className="group/conv relative">
                  <button
                    onClick={() => handleConversationClick(conv.id)}
                    className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors outline-none last:border-b-0 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {conv.title || "Untitled chat"}
                      </span>
                    </span>
                    <span className="shrink-0 pr-7 text-xs text-muted-foreground tnum">
                      {conv.messageCount} · {relativeTime(conv.updatedAt)}
                    </span>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${conv.title || "untitled chat"}`}
                    onClick={() => handleDeleteConversation(conv.id)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/conv:opacity-100"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {composer}
      </div>
    );
  }

  // Active chat
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleMessagesScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between border-b pb-2.5">
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setShowHistory(true)}
            >
              <MessageSquare />
              All chats
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={startNewConversation}
            >
              <Plus />
              New chat
            </Button>
          </div>

          <div className="space-y-6">
            {messages.map((msg) => (
              <MessageRow key={msg.id} message={msg} />
            ))}
          </div>
        </div>
      </div>

      {composer}
    </div>
  );
}

// --- Sub-components ---

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground"
      >
        <Sparkles className="size-3" />
      </span>

      <div className="min-w-0 flex-1">
        {message.webSearchResults && message.webSearchResults.length > 0 && (
          <WebSearchResults searches={message.webSearchResults} />
        )}

        {message.isStreaming && !message.content ? (
          <StatusIndicator
            phase={message.phase ?? "thinking"}
            detail={message.phaseDetail}
          />
        ) : (
          <div className="text-sm leading-relaxed text-foreground/90">
            <p className="whitespace-pre-wrap break-words">
              {message.content}
              {message.isStreaming && (
                <span className="ml-0.5 inline-block h-3.5 w-px animate-caret-blink bg-foreground align-middle" />
              )}
            </p>
          </div>
        )}

        {message.sourcesUsed &&
          message.sourcesUsed.length > 0 &&
          !message.isStreaming && <SourceCitations sources={message.sourcesUsed} />}

        {!message.isStreaming && message.content && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}

const PHASE_LABELS: Record<ChatPhase, string> = {
  thinking: "Thinking",
  reading: "Reading your sources",
  searching: "Searching the web",
  answering: "Answering",
};

/** How long a status must stay on screen before it can be replaced. */
const MIN_PHASE_MS = 600;
/**
 * Once retrieval/search is done the model is already generating, but no event
 * marks that moment. Advance to "Answering" after the prior status has had its
 * turn so the label doesn't sit on a stale step.
 */
const ADVANCE_TO_ANSWERING_MS = 1100;

/**
 * Holds a phase on screen for at least `MIN_PHASE_MS`. Stream events can land
 * milliseconds apart (`sources` follows `metadata` almost immediately), which
 * without this reads as a flicker rather than a status.
 */
interface PhaseState {
  phase: ChatPhase;
  detail?: string;
}

function useStablePhase(phase: ChatPhase, detail?: string) {
  const [shown, setShown] = useState<PhaseState>({ phase, detail });

  // Mirrors `shown` so the timers below can compare without depending on it.
  const shownRef = useRef<PhaseState>({ phase, detail });
  // Lazily set inside the effect — reading a clock during render isn't pure.
  const shownAtRef = useRef<number | null>(null);

  /*
   * Deliberately keyed on the incoming stream phase alone. An earlier version
   * also depended on `shown`, which let the inferred "answering" step disagree
   * with the `phase` prop and get reverted, bouncing the label between
   * "Reading your sources" and "Answering" indefinitely. With only real events
   * as input there's no feedback loop: each phase schedules its own sequence and
   * the cleanup cancels anything still pending.
   */
  useEffect(() => {
    const timers: number[] = [];
    const now = Date.now();
    if (shownAtRef.current === null) shownAtRef.current = now;

    const commit = (next: PhaseState) => {
      const prev = shownRef.current;
      if (prev.phase === next.phase && prev.detail === next.detail) return;
      shownRef.current = next;
      shownAtRef.current = Date.now();
      setShown(next);
    };

    // Let the current label finish its turn before showing the next one.
    const hold = Math.max(0, MIN_PHASE_MS - (now - shownAtRef.current));

    // Always deferred, so this never sets state synchronously during the effect.
    timers.push(window.setTimeout(() => commit({ phase, detail }), hold));

    // Retrieval and search are the final events before tokens arrive, so the
    // label would otherwise sit there describing work that's already done.
    if (phase === "thinking" || phase === "reading") {
      timers.push(
        window.setTimeout(
          () => commit({ phase: "answering" }),
          hold + ADVANCE_TO_ANSWERING_MS
        )
      );
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, detail]);

  return shown;
}

function StatusIndicator({
  phase,
  detail,
}: {
  phase: ChatPhase;
  detail?: string;
}) {
  const shown = useStablePhase(phase, detail);
  const label = PHASE_LABELS[shown.phase];
  const full = shown.detail ? `${label} · “${shown.detail}”` : label;

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex items-center gap-[3px]" aria-hidden="true">
        <span className="size-1.5 animate-thinking-dot rounded-full bg-foreground/35 [animation-delay:0ms]" />
        <span className="size-1.5 animate-thinking-dot rounded-full bg-foreground/35 [animation-delay:160ms]" />
        <span className="size-1.5 animate-thinking-dot rounded-full bg-foreground/35 [animation-delay:320ms]" />
      </span>

      {/* Keyed so each status crossfades in instead of snapping. */}
      <span
        key={full}
        className="animate-status-in min-w-0 text-sm font-medium tracking-tight"
      >
        <span className="animate-text-shimmer bg-clip-text text-transparent">
          {label}
        </span>
        {shown.detail && (
          <span className="ml-1 truncate text-muted-foreground/70">
            “{shown.detail}”
          </span>
        )}
      </span>

      {/* One live region for screen readers, kept out of the visual crossfade. */}
      <span className="sr-only" role="status" aria-live="polite">
        {full}
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.add({ title: "Couldn't copy to clipboard", type: "error" });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-xs" />}
        onClick={handleCopy}
        aria-label="Copy response"
        className="text-muted-foreground"
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy response"}</TooltipContent>
    </Tooltip>
  );
}

function SourceCitations({ sources }: { sources: ChatSource[] }) {
  // Deduplicate by sourceId — handles both old format (per-chunk) and new format (per-source)
  const grouped = sources.reduce<
    Map<string, { title: string; similarity: number; chunkCount: number; content: string }>
  >((map, src) => {
    const key = src.sourceId;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        title: src.title || "",
        similarity: src.similarity,
        chunkCount: src.chunkCount || 1,
        content: src.content || "",
      });
    } else {
      // Keep the highest similarity and sum up chunks
      if (src.similarity > existing.similarity) {
        existing.similarity = src.similarity;
      }
      if (!src.chunkCount) {
        existing.chunkCount += 1;
      }
    }
    return map;
  }, new Map());

  const deduplicated = Array.from(grouped.entries());

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Cited</span>
      {deduplicated.map(([sourceId, src], i) => {
        const label = src.title || `Source ${i + 1}`;
        return (
          <Tooltip key={sourceId}>
            <TooltipTrigger
              render={
                <span className="inline-flex max-w-52 cursor-default items-center gap-1.5 rounded-md border bg-card py-0.5 pr-2 pl-1 text-[11px]" />
              }
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground tnum">
                {i + 1}
              </span>
              <span className="truncate text-foreground/80">{label}</span>
              <span className="shrink-0 text-muted-foreground tnum">
                {Math.round(src.similarity * 100)}%
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <span className="block text-left">
                <span className="block font-medium">{label}</span>
                <span className="mt-0.5 block opacity-80">
                  {src.chunkCount > 1
                    ? `${src.chunkCount} matching chunks`
                    : "1 matching chunk"}
                </span>
                {src.content && (
                  <span className="mt-1 block line-clamp-4 opacity-70">
                    {src.content}
                  </span>
                )}
              </span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function WebSearchResults({
  searches,
}: {
  searches: { query: string; results: WebSearchResult[] }[];
}) {
  return (
    <div className="mb-3 space-y-2">
      {searches.map((search, i) => (
        <div key={i} className="rounded-lg border bg-muted/30 p-2.5">
          <div className="flex items-center gap-1.5">
            <Globe className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-[11px] text-muted-foreground">
              Searched the web for “{search.query}”
            </span>
          </div>

          <div className="mt-1.5 space-y-px">
            {search.results.slice(0, 3).map((result, j) => (
              <a
                key={j}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex items-start gap-1.5 rounded px-1 py-1 transition-colors outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ExternalLink className="mt-0.5 size-2.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-foreground/80 group-hover/link:text-primary">
                    {result.title}
                  </span>
                  <span className="line-clamp-1 text-[11px] text-muted-foreground">
                    {result.content}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Composer({
  input,
  setInput,
  hasSources,
  isStreaming,
  model,
  sourceCount,
  onSend,
  onStop,
}: {
  input: string;
  setInput: (v: string) => void;
  hasSources: boolean;
  isStreaming: boolean;
  model: string;
  sourceCount: number;
  onSend: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex-shrink-0 border-t px-4 py-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="mx-auto w-full max-w-3xl"
      >
        <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 transition-colors focus-within:border-ring/60">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            disabled={!hasSources}
            placeholder={
              hasSources
                ? "Ask a question about your sources…"
                : "Add a source to start asking questions"
            }
            aria-label="Message"
            className="max-h-40 min-h-8 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />

          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onStop}
              aria-label="Stop generating"
              className="shrink-0"
            >
              <Square className="text-destructive" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              disabled={!input.trim() || !hasSources}
              aria-label="Send message"
              className="shrink-0"
            >
              <Send />
            </Button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span className="truncate tnum">
            {hasSources
              ? `${pluralize(sourceCount, "source")} · ${model}`
              : "No sources indexed yet"}
          </span>
          {hasSources && (
            <span className="hidden shrink-0 items-center gap-1 sm:flex">
              <Kbd>↵</Kbd> send
              <span className="mx-0.5 opacity-40">·</span>
              <Kbd>⇧↵</Kbd> newline
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
