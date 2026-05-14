"use client";


import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProjectSidebar } from "@/components/projects/ProjectSidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useProject } from "@/hooks/useProject";
import type { Project, KnowledgeFile } from "@/types/project";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { fetchProject, updateProject, uploadFile, deleteFile } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchProject(id).then((p) => {
      if (p) {
        setProject(p);
        setFiles(p.knowledgeFiles ?? []);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUpdate = useCallback(async (updates: Partial<Pick<Project, "name" | "description" | "systemPrompt">>) => {
    await updateProject(id, updates);
    setProject((prev) => prev ? { ...prev, ...updates } : prev);
  }, [id, updateProject]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const kf = await uploadFile(id, file);
      if (kf) setFiles((prev) => [...prev, kf]);
    } finally {
      setUploading(false);
    }
  }, [id, uploadFile]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    const ok = await deleteFile(id, fileId);
    if (ok) setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, [id, deleteFile]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="text-surya-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Left: Project sidebar (30%) */}
      <div className="w-72 shrink-0 h-full">
        <ProjectSidebar
          project={project}
          files={files}
          uploading={uploading}
          onUpdate={handleUpdate}
          onUpload={handleUpload}
          onDeleteFile={handleDeleteFile}
        />
      </div>

      {/* Right: Chat (70%) */}
      <div className="flex-1 h-full min-w-0">
        <ChatInterface projectId={id} />
      </div>
    </div>
  );
}