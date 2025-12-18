"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProjects, Project } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { getRandomEmoji } from "@/lib/emojiUtils";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProjects = async () => {
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
          .sort((a, b) => {
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
  }, [user]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "Unknown";
    
    let date: Date;
    if (timestamp.toMillis) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return "Unknown";
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getProjectTypeLabel = (workflowType: string): string => {
    return workflowType === "text-to-3d" ? "Text to 3D" : "Floorplan 3D";
  };

  const getProjectImage = (project: Project): string => {
    // Try to get image from output_data or input_data
    if (project.workflow_type === "text-to-3d") {
      return project.output_data?.image_url || "/file.svg";
    } else {
      return project.output_data?.isometric_path || project.output_data?.floorplan_path || "/file.svg";
    }
  };

  const handleImageError = (projectId: string) => {
    setFailedImages((prev) => new Set(prev).add(projectId));
  };

  const handleProjectClick = (project: Project) => {
    router.push(`/dashboard/projects/${project.id}`);
  };

  const getProjectTitle = (project: Project): string => {
    if (project.input_data?.prompt) {
      return project.input_data.prompt.length > 30 
        ? project.input_data.prompt.substring(0, 30) + "..."
        : project.input_data.prompt;
    }
    return `Project ${project.id}`;
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
                  .sort((a, b) => {
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
          {projects.map((project, index) => {
            const thumbnail = getProjectImage(project);
            const showEmoji = failedImages.has(project.id) || thumbnail === "/file.svg";
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleProjectClick(project)}
                className="group rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:bg-white/10 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="aspect-square relative overflow-hidden bg-black/50 flex items-center justify-center">
                  {showEmoji ? (
                    <div className="text-6xl">{getRandomEmoji(project.workflow_type, project.id)}</div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={thumbnail} 
                        alt={getProjectTitle(project)} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        onError={() => handleImageError(project.id)}
                      />
                    </>
                  )}
                  <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-medium border border-white/10">
                    {getProjectTypeLabel(project.workflow_type)}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold truncate text-white/90">{getProjectTitle(project)}</h3>
                  <p className="text-xs text-white/40 mt-1">{formatDate(project.created_at)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

