"use client";

import { useState, useEffect } from "react";
import { fetchProjects, Project } from "@/lib/client-api";
import NewProjectCard from "@/components/NewProjectCard";
import ProjectHistoryGrid from "@/components/ProjectHistoryGrid";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorDisplay } from "@/components/ErrorDisplay";

export default function TextTo3DPage() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProjects("text-to-3d");
        setProjects(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e : new Error("Failed to load projects"));
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [user, authLoading]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Text to 3D Projects</h1>
        <p className="text-white/60 mt-2">Manage your text-generated 3D assets.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Create New Card */}
        <NewProjectCard href="/dashboard/text-to-3d/new" />
      </div>

      {/* History Items - Now includes active generations */}
      <ProjectHistoryGrid
        projects={projects}
        loading={loading || authLoading}
        workflowType="text-to-3d"
        error={error}
        onRetry={() => {
          setError(null);
          const loadProjects = async () => {
            if (!user) return;
            try {
              setLoading(true);
              setError(null);
              const data = await fetchProjects("text-to-3d");
              setProjects(data);
            } catch (e) {
              console.error(e);
              setError(e instanceof Error ? e : new Error("Failed to load projects"));
            } finally {
              setLoading(false);
            }
          };
          loadProjects();
        }}
      />
    </div>
  );
}
