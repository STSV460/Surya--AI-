"use client";

import { useState, useCallback } from "react";
import type { Project, KnowledgeFile } from "@/types/project";

export function useProject() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const data = await res.json();
      setProjects(data.documents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(async (id: string): Promise<Project | null> => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.document ?? null;
  }, []);

  const createProject = useCallback(async (name: string, description: string, systemPrompt: string): Promise<Project | null> => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, systemPrompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const project = data.document as Project;
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<Pick<Project, "name" | "description" | "systemPrompt">>) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return res.ok;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
    return res.ok;
  }, []);

  const uploadFile = useCallback(async (projectId: string, file: File): Promise<KnowledgeFile | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let msg = "Upload failed";
        try {
          const errBody = await res.json() as { error?: string; detail?: string; code?: string };
          msg = errBody.error ?? msg;
          if (errBody.detail) msg += ` — ${errBody.detail}`;
          if (errBody.code) msg += ` (${errBody.code})`;
        } catch {
          msg = (await res.text()) || msg;
        }
        throw new Error(msg);
      }
      const data = await res.json();
      return data.document as KnowledgeFile;
    } finally {
      setUploading(false);
    }
  }, []);

  const deleteFile = useCallback(async (projectId: string, fileId: string) => {
    const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, { method: "DELETE" });
    return res.ok;
  }, []);

  return {
    projects,
    loading,
    uploading,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    uploadFile,
    deleteFile,
  };
}
