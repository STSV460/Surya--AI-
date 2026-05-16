"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chatStore";
import type { StreamEvent, Message, ArtifactType, SearchResult } from "@/types/chat";
const randomUUID = () => crypto.randomUUID();

export function useChat(projectId?: string) {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const {
    messages,
    isStreaming,
    streamingContent,
    thinkingEnabled,
    enableConnectors,
    enableWebSearch,
    enableImageGen,
    enableVideoGen,
    activeConversationId,
    addMessage,
    replaceMessageAndTruncate,
    updateStreamingContent,
    setIsStreaming,
    setActiveConversation,
    setEnableConnectors,
    setEnableWebSearch,
    setEnableImageGen,
    setEnableVideoGen,
    resetStream,
  } = useChatStore();

  const sendMessage = useCallback(
    async (
      content: string,
      conversationId?: string,
      options?: { editMessageId?: string }
    ) => {
      if (isStreaming || !content.trim()) return;

      const convId = conversationId ?? activeConversationId ?? undefined;
      const editMessageId = options?.editMessageId;

      if (editMessageId) {
        // ChatGPT-style edit: rewrite the original message and drop everything after it
        replaceMessageAndTruncate(editMessageId, content);
      } else {
        // Optimistically add new user message
        const userMsg: Message = {
          id: randomUUID(),
          conversationId: convId ?? "",
          role: "user",
          content,
          artifacts: [],
          createdAt: new Date().toISOString(),
        };
        addMessage(userMsg);
      }
      setIsStreaming(true);
      updateStreamingContent("");

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            thinking: thinkingEnabled,
            conversationId: convId,
            projectId: projectId ?? undefined,
            enableConnectors,
            enableWebSearch,
            enableImageGen,
            enableVideoGen,
            editMessageId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";
        let streamedThinking = "";
        const streamedArtifacts: ArtifactType[] = [];
        let pendingSearchResults: SearchResult[] = [];
        let newConvId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            switch (event.type) {
              case "text":
                streamedText += event.content ?? "";
                updateStreamingContent(streamedText);
                break;
              case "thinking":
                streamedThinking += event.content ?? "";
                break;
              case "artifact_start":
              case "artifact_end":
                if (event.artifact) {
                  const existing = streamedArtifacts.findIndex(
                    (a) => a.id === event.artifact!.id
                  );
                  if (existing === -1) {
                    streamedArtifacts.push(event.artifact as ArtifactType);
                  } else {
                    streamedArtifacts[existing] = {
                      ...streamedArtifacts[existing],
                      ...event.artifact,
                    } as ArtifactType;
                  }
                }
                break;
              case "search_results":
                pendingSearchResults = event.searchResults ?? [];
                break;
              case "research_progress":
                break;
              case "done":
                newConvId = event.content ?? null;
                break;
              case "error":
                throw new Error(event.error ?? "Stream error");
            }
          }
        }

        // Commit final assistant message
        const assistantMsg: Message = {
          id: randomUUID(),
          conversationId: newConvId ?? convId ?? "",
          role: "assistant",
          content: streamedText,
          artifacts: streamedArtifacts,
          thinking: streamedThinking || undefined,
          searchResults: pendingSearchResults.length > 0 ? pendingSearchResults : undefined,
          createdAt: new Date().toISOString(),
        };
        addMessage(assistantMsg);

        if (newConvId && newConvId !== convId) {
          setActiveConversation(newConvId);
          // Stay on project page if this is a project chat
          if (!projectId) {
            router.replace(`/chat/${newConvId}`);
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const errMsg: Message = {
          id: randomUUID(),
          conversationId: convId ?? "",
          role: "assistant",
          content: `Error: ${(err as Error).message}`,
          artifacts: [],
          createdAt: new Date().toISOString(),
        };
        addMessage(errMsg);
      } finally {
        resetStream();
      }
    },
    [
      isStreaming,
      activeConversationId,
      thinkingEnabled,
      enableConnectors,
      enableWebSearch,
      enableImageGen,
      enableVideoGen,
      addMessage,
      replaceMessageAndTruncate,
      updateStreamingContent,
      setIsStreaming,
      setActiveConversation,
      setEnableConnectors,
      setEnableWebSearch,
      setEnableImageGen,
      setEnableVideoGen,
      resetStream,
      router,
    ]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    resetStream();
  }, [resetStream]);

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    stopStreaming,
    enableConnectors,
    setEnableConnectors,
    enableWebSearch,
    setEnableWebSearch,
    enableImageGen,
    setEnableImageGen,
    enableVideoGen,
    setEnableVideoGen,
  };
}
