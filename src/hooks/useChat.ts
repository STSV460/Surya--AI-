"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chatStore";
import type { StreamEvent, Message, ArtifactType, SearchResult, CrewProgressEvent } from "@/types/chat";
const randomUUID = () => crypto.randomUUID();

type ScheduleFrequency = "once" | "hourly" | "daily" | "weekly";

function inferScheduleFrequency(text: string): ScheduleFrequency {
  const value = text.toLowerCase();
  if (value.includes("hourly") || value.includes("every hour")) return "hourly";
  if (value.includes("weekly") || value.includes("every week") || value.includes("friday") || value.includes("monday")) return "weekly";
  if (value.includes("once") || value.includes("tomorrow") || value.includes("one time")) return "once";
  return "daily";
}

function inferScheduleTarget(text: string) {
  const value = text.toLowerCase();
  if (value.includes("code") || value.includes("bug") || value.includes("build") || value.includes("project")) return "code";
  if (value.includes("research") || value.includes("news") || value.includes("search") || value.includes("brief")) return "research";
  return "chat";
}

function inferScheduleTitle(text: string) {
  const clean = text.replace(/^\/schedule\s*/i, "").replace(/\s+/g, " ").trim();
  if (!clean) return "Scheduled task";
  const first = clean.split(/[.!?]/)[0] ?? clean;
  return first.length > 58 ? `${first.slice(0, 55).trim()}...` : first;
}

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
    enableCrew,
    crewMode,
    crewEvents,
    activeConversationId,
    addMessage,
    updateStreamingContent,
    setIsStreaming,
    setActiveConversation,
    setEnableConnectors,
    setEnableWebSearch,
    setEnableImageGen,
    setEnableVideoGen,
    setEnableCrew,
    setCrewMode,
    resetCrewEvents,
    addCrewEvent,
    resetStream,
    replaceFromEditedMessage,
  } = useChatStore();

  const sendMessage = useCallback(
    async (content: string, conversationId?: string, options?: { editMessageId?: string }) => {
      if (isStreaming || !content.trim()) return;

      const convId = conversationId ?? activeConversationId ?? undefined;
      const editMessageId = options?.editMessageId;

      if (editMessageId) {
        replaceFromEditedMessage(editMessageId, content);
      } else {
        // Optimistically add user message
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
      resetCrewEvents();

      abortRef.current = new AbortController();

      try {
        const scheduleMode = enableCrew || /^\/schedule\b/i.test(content.trim());
        if (scheduleMode) {
          const prompt = content.replace(/^\/schedule\s*/i, "").trim();
          if (!prompt) throw new Error("Tell Surya what task to schedule.");
          const res = await fetch("/api/scheduled-tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: inferScheduleTitle(content),
              prompt,
              frequency: inferScheduleFrequency(prompt),
              target: inferScheduleTarget(prompt),
              model: "opus",
            }),
            signal: abortRef.current.signal,
          });
          const data = await res.json();
          if (!res.ok || !data.task) throw new Error(data.error ?? "Schedule failed");
          const assistantMsg: Message = {
            id: randomUUID(),
            conversationId: convId ?? "",
            role: "assistant",
            content: `Scheduled "${data.task.title}". You can see it in Scheduled Tasks.`,
            artifacts: [],
            createdAt: new Date().toISOString(),
          };
          addMessage(assistantMsg);
          return;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            editMessageId,
            thinking: thinkingEnabled,
            conversationId: convId,
            projectId: projectId ?? undefined,
            enableConnectors,
            enableWebSearch,
            enableImageGen,
            enableVideoGen,
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
        const pendingCrewEvents: CrewProgressEvent[] = [];
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
              case "crew_start":
              case "crew_agent_step":
              case "crew_agent_complete":
              case "crew_task_complete":
              case "crew_complete": {
                const crewEvent = event as CrewProgressEvent;
                pendingCrewEvents.push(crewEvent);
                addCrewEvent(crewEvent);
                if (event.type === "crew_agent_step" && event.thought) {
                  updateStreamingContent(event.thought);
                }
                if (event.type === "crew_task_complete" && event.output) {
                  updateStreamingContent(event.output);
                }
                if (event.type === "crew_complete") {
                  streamedText = event.finalOutput ?? event.content ?? streamedText;
                  updateStreamingContent(streamedText);
                }
                break;
              }
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
          crewSteps: pendingCrewEvents.length > 0 ? pendingCrewEvents : undefined,
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
      enableCrew,
      addMessage,
      replaceFromEditedMessage,
      updateStreamingContent,
      setIsStreaming,
      setActiveConversation,
      resetCrewEvents,
      addCrewEvent,
      resetStream,
      router,
      projectId,
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
    enableCrew,
    setEnableCrew,
    crewMode,
    setCrewMode,
    crewEvents,
  };
}
