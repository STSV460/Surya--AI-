"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { useResearch } from "@/hooks/useResearch";
import { useChatStore } from "@/stores/chatStore";
import { MessageList } from "@/components/chat/MessageList";
import { InputBar } from "@/components/chat/InputBar";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { ResearchProgress } from "@/components/chat/ResearchProgress";
import { useUIStore } from "@/stores/uiStore";
import type { Message } from "@/types/chat";

interface ChatInterfaceProps {
  conversationId?: string;
  projectId?: string;
}

export function ChatInterface({ conversationId, projectId }: ChatInterfaceProps) {
  const router = useRouter();

  const {
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
  } = useChat(projectId);

  const {
    isRunning: isResearching,
    stage: researchStage,
    detail: researchDetail,
    completedArtifact,
    error: researchError,
    resultConversationId,
    startResearch,
    reset: resetResearch,
  } = useResearch();

  const { setMessages, setActiveConversation, activeConversationId, addMessage } = useChatStore();
  const { artifactPanelOpen } = useUIStore();

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setActiveConversation(null);
      return;
    }

    if (conversationId === activeConversationId) return;

    setActiveConversation(conversationId);

    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => {
        if (r.status === 404 || r.status === 403) {
          router.replace("/chat");
          throw new Error("not_found");
        }
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        setMessages(data.documents ?? []);
      })
      .catch((err) => {
        if (err?.message !== "not_found") {
          console.error("[chat] load messages failed:", err);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Commit completed research artifact into chat message store
  useEffect(() => {
    if (!completedArtifact) return;

    const researchMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: resultConversationId ?? conversationId ?? "",
      role: "assistant",
      content: completedArtifact.content,
      artifacts: [completedArtifact],
      createdAt: new Date().toISOString(),
    };
    addMessage(researchMsg);

    if (resultConversationId && resultConversationId !== conversationId && !projectId) {
      router.replace(`/chat/${resultConversationId}`);
    }

    resetResearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedArtifact]);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Chat column */}
      <div className="relative z-10 flex flex-col flex-1 min-w-0 h-full">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          onSend={(content) => sendMessage(content, conversationId)}
          onEditMessage={(messageId, newContent) =>
            sendMessage(newContent, conversationId, { editMessageId: messageId })
          }
        />

        {/* Deep Research progress — animated stages */}
        <ResearchProgress
          stage={researchStage}
          detail={researchDetail}
          isRunning={isResearching}
        />

        {/* Research error */}
        {researchError && !isResearching && (
          <div className="mx-auto max-w-3xl px-4 mb-2">
            <p className="text-xs text-red-400 text-center">Research failed: {researchError}</p>
          </div>
        )}

        <div className={`px-4 pb-6 pt-2 w-full ${artifactPanelOpen ? "max-w-2xl" : "max-w-3xl"} mx-auto`}>
          <InputBar
            onSend={(content) => sendMessage(content, conversationId)}
            onStop={stopStreaming}
            isStreaming={isStreaming || isResearching}
            enableConnectors={enableConnectors}
            onToggleConnectors={() => setEnableConnectors(!enableConnectors)}
            enableWebSearch={enableWebSearch}
            onToggleWebSearch={() => setEnableWebSearch(!enableWebSearch)}
            enableImageGen={enableImageGen}
            onToggleImageGen={() => setEnableImageGen(!enableImageGen)}
            enableVideoGen={enableVideoGen}
            onToggleVideoGen={() => setEnableVideoGen(!enableVideoGen)}
            onDeepResearch={(question) => startResearch(question, conversationId, projectId)}
          />
        </div>
      </div>

      {/* Artifact panel */}
      <ArtifactPanel />
    </div>
  );
}
