"use client";

import { useState, useCallback, useRef } from "react";
import { chatApi, Message, ChatSource, WebSearchResult } from "@/lib/api";

export type ChatPhase = "thinking" | "searching" | "reading" | "answering";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourcesUsed: ChatSource[] | null;
  webSearchResults: { query: string; results: WebSearchResult[] }[] | null;
  isStreaming?: boolean;
  phase?: ChatPhase;
  /** Extra context for the current phase, e.g. the active web search query. */
  phaseDetail?: string;
}

export function useChat(notebookId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const loadConversation = useCallback(async (convId: string) => {
    setConversationId(convId);
    try {
      const result = await chatApi.getMessages(notebookId, convId, { limit: 50 });
      const mapped: ChatMessage[] = result.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sourcesUsed: m.sourcesUsed as ChatSource[] | null,
        webSearchResults: null,
      }));
      setMessages(mapped);
    } catch {
      // If loading fails, start fresh
      setMessages([]);
    }
  }, [notebookId]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;

    // Add user message to UI immediately
    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: text,
      sourcesUsed: null,
      webSearchResults: null,
    };

    // Add assistant placeholder
    const tempAssistantMsg: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      sourcesUsed: null,
      webSearchResults: null,
      isStreaming: true,
      phase: "thinking",
    };

    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);
    setIsLoading(true);
    setIsStreaming(true);

    let assistantContent = "";
    let assistantSources: ChatSource[] | null = null;
    let assistantWebSearchResults: { query: string; results: WebSearchResult[] }[] = [];
    let realAssistantId = tempAssistantMsg.id;
    let realConversationId = conversationId;

    const { abort } = chatApi.sendMessage(
      notebookId,
      { conversationId, message: text },
      {
        onMetadata: (meta) => {
          realAssistantId = meta.messageId;
          realConversationId = meta.conversationId;
          setConversationId(meta.conversationId);

          // Update user message ID (we used a temp one)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempUserMsg.id
                ? { ...m, id: `user-${meta.messageId}` }
                : m
            )
          );
        },
        onChunk: (text) => {
          assistantContent += text;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMsg.id || m.id === realAssistantId
                ? {
                    ...m,
                    id: realAssistantId,
                    content: assistantContent,
                    isStreaming: true,
                    phase: "answering",
                    phaseDetail: undefined,
                  }
                : m
            )
          );
        },
        onSources: (sources) => {
          assistantSources = sources;
          // Only reflect "reading" while we haven't started answering yet.
          setMessages((prev) =>
            prev.map((m) =>
              (m.id === tempAssistantMsg.id || m.id === realAssistantId) && !assistantContent
                ? { ...m, id: realAssistantId, phase: "reading" }
                : m
            )
          );
        },
        onWebSearchStart: (data) => {
          // Fires before the search runs, so this status is live rather than
          // retroactive. Tool calls can happen mid-stream, so only show it as a
          // status while there's no answer text yet.
          setMessages((prev) =>
            prev.map((m) =>
              (m.id === tempAssistantMsg.id || m.id === realAssistantId) && !assistantContent
                ? { ...m, id: realAssistantId, phase: "searching", phaseDetail: data.query }
                : m
            )
          );
        },
        onWebSearch: (data) => {
          assistantWebSearchResults = [...assistantWebSearchResults, data];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMsg.id || m.id === realAssistantId
                ? {
                    ...m,
                    id: realAssistantId,
                    webSearchResults: assistantWebSearchResults,
                    // Results are in; the model is now composing the answer.
                    phase: assistantContent ? m.phase : "answering",
                    phaseDetail: undefined,
                  }
                : m
            )
          );
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === realAssistantId
                ? { ...m, content: assistantContent, sourcesUsed: assistantSources, webSearchResults: assistantWebSearchResults.length > 0 ? assistantWebSearchResults : null, isStreaming: false, phase: undefined, phaseDetail: undefined }
                : m
            )
          );
          setIsLoading(false);
          setIsStreaming(false);
        },
        onError: (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMsg.id || m.id === realAssistantId
                ? { ...m, content: `Error: ${error}`, isStreaming: false, phase: undefined, phaseDetail: undefined }
                : m
            )
          );
          setIsLoading(false);
          setIsStreaming(false);
        },
      }
    );

    abortRef.current = abort;
  }, [notebookId, conversationId, isStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.();
    setIsStreaming(false);
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming
          ? { ...m, isStreaming: false, phase: undefined, phaseDetail: undefined }
          : m
      )
    );
  }, []);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  return {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    sendMessage,
    stopStreaming,
    loadConversation,
    startNewConversation,
  };
}
