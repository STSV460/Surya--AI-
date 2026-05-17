"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Plus, Settings, MessageSquare, FolderOpen, Search, Code2, Film, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chatStore";
import { useUIStore } from "@/stores/uiStore";
import { useUserStore } from "@/stores/userStore";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/chat";

function groupConversations(conversations: Conversation[]) {
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (isToday(date)) today.push(conv);
    else if (isYesterday(date)) yesterday.push(conv);
    else older.push(conv);
  }

  return { today, yesterday, older };
}

export function Sidebar() {
  const { conversations, setConversations, activeConversationId } = useChatStore();
  const { sidebarOpen } = useUIStore();
  const user = useUserStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  function startRename(id: string) {
    const current = conversations.find((c) => c.id === id);
    setRenamingId(id);
    setRenameValue(current?.title ?? "");
    // focus on next tick once input mounts
    setTimeout(() => renameInputRef.current?.select(), 0);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function commitRename() {
    if (!renamingId) return;
    const id = renamingId;
    const next = renameValue.trim();
    const current = conversations.find((c) => c.id === id);
    if (!next || next === current?.title) {
      cancelRename();
      return;
    }
    setRenamingId(null);
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    if (res.ok) {
      setConversations(conversations.map((c) => (c.id === id ? { ...c, title: next } : c)));
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    const id = deleteId;
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConversations(conversations.filter((c) => c.id !== id));
      if (activeConversationId === id) router.replace("/chat");
    }
    setIsDeleting(false);
    setDeleteId(null);
  }

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const docs = Array.isArray(data?.documents) ? data.documents : Array.isArray(data) ? data : null;
        if (docs) setConversations(docs);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when active conversation changes to one not in the list
  useEffect(() => {
    if (!activeConversationId) return;
    const exists = conversations.some((c) => c.id === activeConversationId);
    if (!exists) {
      fetch("/api/conversations")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          const docs = Array.isArray(data?.documents) ? data.documents : Array.isArray(data) ? data : null;
          if (docs) setConversations(docs);
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Filter conversations by search query
  const filtered = searchQuery.trim()
    ? conversations.filter((c) =>
        (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const { today, yesterday, older } = groupConversations(filtered);

  function ConvGroup({ label, items }: { label: string; items: Conversation[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="text-[10px] text-gray-600 uppercase px-3 pt-3 pb-1 font-medium tracking-wider">
          {label}
        </p>
        {items.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group relative flex items-center gap-2 mx-1 rounded-lg transition-colors",
              conv.id === activeConversationId
                ? "bg-surface-2 text-white"
                : "text-gray-400 hover:bg-surface-2/60 hover:text-white"
            )}
          >
            {renamingId === conv.id ? (
              <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0">
                <MessageSquare size={13} className="shrink-0 opacity-50" />
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={commitRename}
                  autoFocus
                  className="flex-1 min-w-0 bg-surface-2 text-xs text-white border border-surya-500/40 rounded px-2 py-1 outline-none focus:border-surya-500"
                />
              </div>
            ) : (
              <Link
                href={`/chat/${conv.id}`}
                className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0 text-sm"
              >
                <MessageSquare size={13} className="shrink-0 opacity-50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{conv.title || "New conversation"}</p>
                  <p className="text-[10px] text-gray-600">
                    {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100 p-1.5 mr-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-opacity"
                aria-label="Conversation actions"
              >
                <MoreHorizontal size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => startRename(conv.id)}>
                  <Pencil size={12} className="mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteId(conv.id)}
                  className="text-red-400 focus:text-red-400"
                >
                  <Trash2 size={12} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => useUIStore.getState().setSidebarOpen(false)}
        />
      )}
    <aside
      className={cn(
        "flex flex-col h-full bg-[#151821] border-r border-white/6 transition-all duration-200 shrink-0 overflow-hidden",
        "md:relative md:translate-x-0",
        sidebarOpen ? "w-[260px]" : "w-0 md:w-0",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-2xl"
      )}
    >
      {/* Logo + brand */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <Image src="/logo.png" alt="Surya" width={24} height={24} className="rounded-[6px] shrink-0" />
        <span className="font-semibold text-[15px] tracking-[-0.02em] text-white">Surya AI</span>
      </div>

      {/* New Chat + nav */}
      <div className="px-3 pb-2 space-y-1">
        <Link
          href="/chat"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium
            bg-surya-500/12 hover:bg-surya-500/20 border border-surya-500/25 text-surya-500
            transition-colors"
        >
          <Plus size={15} />
          New Chat
        </Link>
        <Link
          href="/projects"
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors",
            pathname.startsWith("/projects")
              ? "bg-surface-2 text-white"
              : "text-gray-500 hover:text-white hover:bg-white/[0.04]"
          )}
        >
          <FolderOpen size={15} />
          Projects
        </Link>
        <Link
          href="/media"
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors",
            pathname.startsWith("/media")
              ? "bg-surface-2 text-white"
              : "text-gray-500 hover:text-white hover:bg-white/[0.04]"
          )}
        >
          <Film size={15} />
          Media
        </Link>
        <Link
          href="/app-builder"
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors",
            pathname.startsWith("/app-builder")
              ? "bg-surface-2 text-white"
              : "text-gray-500 hover:text-white hover:bg-white/[0.04]"
          )}
        >
          <Code2 size={15} />
          Code
        </Link>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/6 mx-3 mb-2" />

      {/* Search bar */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-white/8">
          <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white/70 placeholder:text-white/25 outline-none w-full"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-xs text-gray-600 px-4 py-3">No conversations yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-600 px-4 py-3">No results for &quot;{searchQuery}&quot;</p>
        ) : (
          <>
            <ConvGroup label="Today" items={today} />
            <ConvGroup label="Yesterday" items={yesterday} />
            <ConvGroup label="Older" items={older} />
          </>
        )}
      </div>

      {/* User + settings */}
      <div className="border-t border-white/6 p-3 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold text-white shrink-0 bg-surya-500"
        >
          {user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-white font-medium truncate">{user?.name ?? "User"}</p>
          <p className="text-[10.5px] text-gray-500 capitalize">{user?.plan ?? "free"} plan</p>
        </div>
        <Link
          href="/settings"
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
            pathname.startsWith("/settings")
              ? "text-surya-500"
              : "text-gray-500 hover:text-white hover:bg-white/8"
          )}
        >
          <Settings size={14} />
        </Link>
      </div>
    </aside>

    <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete conversation?</DialogTitle>
          <DialogDescription>
            This conversation and its messages will be permanently removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
