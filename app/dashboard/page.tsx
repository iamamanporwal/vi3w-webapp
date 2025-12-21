"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProjects, Project } from "@/lib/client-api";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { ProjectCard } from "@/components/ProjectCard";
import { getRandomEmoji } from "@/lib/emojiUtils";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const loadProjects = async () => {
      if (authLoading) return;

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Fetch all projects without workflow filter
        const fetchedProjects = await fetchProjects();
        // Sort by created_at (newest first) and limit to 8
        const sortedProjects = fetchedProjects
          .sort((a: Project, b: Project) => {
            const aTime = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
            const bTime = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
            return bTime - aTime;
          })
          .slice(0, 8);
        setProjects(sortedProjects);
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError("Failed to load projects");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [user, authLoading]);

  const handleProjectClick = (project: Project) => {
    router.push(`/dashboard/projects/${project.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-white/60">Welcome back{user?.displayName ? `, ${user.displayName}` : ''}, let's create something new.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/text-to-3d"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <Link href="/dashboard/text-to-3d" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/40 to-black border border-white/10 p-8 hover:border-purple-500/50 transition-all">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Text to 3D</h3>
            <p className="text-white/60 mb-6 max-w-sm">Generate high-quality 3D assets from text descriptions in seconds.</p>
            <div className="flex items-center text-purple-400 font-medium group-hover:text-purple-300">
              Start Generating <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-purple-600/20 blur-[80px] -translate-y-1/2 translate-x-1/2" />
        </Link>

        <Link href="/dashboard/floorplan-3d" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/40 to-black border border-white/10 p-8 hover:border-blue-500/50 transition-all">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Floorplan to 3D</h3>
            <p className="text-white/60 mb-6 max-w-sm">Convert 2D architectural blueprints into walkable 3D models.</p>
            <div className="flex items-center text-blue-400 font-medium group-hover:text-blue-300">
              Start Generating <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-600/20 blur-[80px] -translate-y-1/2 translate-x-1/2" />
        </Link>
      </div>

      {/* Recent Projects */}
      <h2 className="text-xl font-semibold mb-6">Recent Projects</h2>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorDisplay
          error={error}
          onRetry={() => {
            setError(null);
            // Reload projects
            const loadProjects = async () => {
              if (!user) return;
              try {
                setLoading(true);
                setError(null);
                const fetchedProjects = await fetchProjects();
                const sortedProjects = fetchedProjects
                  .sort((a: Project, b: Project) => {
                    const aTime = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
                    const bTime = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
                    return bTime - aTime;
                  })
                  .slice(0, 8);
                setProjects(sortedProjects);
              } catch (err) {
                console.error("Error fetching projects:", err);
                setError(err instanceof Error ? err.message : "Failed to load projects");
              } finally {
                setLoading(false);
              }
            };
            loadProjects();
          }}
          retryLabel="Reload projects"
        />
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <p>No projects yet. Create your first project to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              onClick={handleProjectClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

