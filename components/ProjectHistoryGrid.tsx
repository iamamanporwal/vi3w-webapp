"use client";

import { useState } from "react";
import { Project, Generation } from "@/lib/api";
import { useGeneration } from "@/contexts/GenerationContext";
import { useRouter } from "next/navigation";
import { SkeletonProjectCard } from "./SkeletonLoader";
import { ErrorDisplay } from "./ErrorDisplay";
import { getRandomEmoji } from "@/lib/emojiUtils";

interface Props {
  projects: Project[];
  loading: boolean;
  workflowType?: "text-to-3d" | "floorplan-3d";
  error?: string | Error | null;
  onRetry?: () => void;
}

export default function ProjectHistoryGrid({ projects, loading, workflowType, error, onRetry }: Props) {
  const { activeGenerations } = useGeneration();
  const router = useRouter();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Filter active generations by workflow type if specified
  const filteredGenerations = workflowType
    ? activeGenerations.filter((gen) => gen.workflow_type === workflowType)
    : activeGenerations;

  // Merge active generations with completed projects
  // Active generations should appear first
  const allItems: Array<{ type: "generation" | "project"; data: Generation | Project }> = [
    ...filteredGenerations.map((gen) => ({ type: "generation" as const, data: gen })),
    ...projects.map((proj) => ({ type: "project" as const, data: proj })),
  ];

  const handleImageError = (id: string) => {
    setFailedImages((prev) => new Set(prev).add(id));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonProjectCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={onRetry}
        retryLabel="Reload projects"
      />
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="text-center py-12 text-white/60">
        <p>No projects yet. Start one above!</p>
      </div>
    );
  }

  const handleGenerationClick = (generation: Generation) => {
    // If generation has a project_id, navigate to project detail page
    // Otherwise, navigate to generation page
    if (generation.project_id) {
      router.push(`/dashboard/projects/${generation.project_id}`);
    } else if (generation.workflow_type === "text-to-3d") {
      router.push(`/dashboard/text-to-3d/new?generationId=${generation.id}`);
    } else if (generation.workflow_type === "floorplan-3d") {
      router.push(`/dashboard/floorplan-3d/new?generationId=${generation.id}`);
    }
  };

  const handleProjectClick = (project: Project) => {
    // Navigate to project detail page
    router.push(`/dashboard/projects/${project.id}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {allItems.map((item) => {
        if (item.type === "generation") {
          const generation = item.data as Generation;
          const title = generation.workflow_type === "text-to-3d"
            ? generation.input_data?.prompt || "Generating..."
            : (generation.input_data?.prompt || "Generating...");
          
          const thumbnail = generation.output_data?.image_url || 
                           generation.output_data?.isometric_path || 
                           generation.output_data?.floorplan_path || 
                           "/file.svg";

          return (
            <div
              key={generation.id}
              onClick={() => handleGenerationClick(generation)}
              className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:bg-white/10 transition group cursor-pointer"
            >
              <div className="relative h-48 w-full bg-black/20 flex items-center justify-center">
                {failedImages.has(generation.id) || thumbnail === "/file.svg" ? (
                  <div className="text-6xl">{getRandomEmoji(generation.workflow_type, generation.id)}</div>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={thumbnail} 
                      alt={title} 
                      className="object-cover w-full h-full"
                      onError={() => handleImageError(generation.id)}
                    />
                  </>
                )}
                {/* Status overlay */}
                <div className="absolute top-2 right-2">
                  {generation.status === "generating" && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <span className="animate-spin">⏳</span> Generating
                    </span>
                  )}
                  {generation.status === "pending" && (
                    <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded">
                      Pending
                    </span>
                  )}
                  {generation.status === "failed" && (
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">
                      Failed
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium truncate text-white" title={title}>{title}</h3>
                <p className="text-xs text-white/50 mt-1 capitalize">
                  {generation.workflow_type.replace(/-/g, " ")}
                </p>
                
                {/* Progress bar for active generations */}
                {(generation.status === "generating" || generation.status === "pending") && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>Progress</span>
                      <span>{generation.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${generation.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {generation.status === "failed" && generation.error_message && (
                  <p className="text-xs text-red-400 mt-2 truncate" title={generation.error_message}>
                    {generation.error_message}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  {generation.status === "completed" && generation.output_data?.model_url && (
                    <a
                      href={generation.output_data.model_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition"
                    >
                      Download 3D
                    </a>
                  )}
                  {(generation.status === "generating" || generation.status === "pending") && (
                    <span className="text-xs bg-blue-600/50 text-white px-3 py-1.5 rounded cursor-pointer">
                      Click to view
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // Regular project card
        const project = item.data as Project;
        const title = project.workflow_type === "text-to-3d" 
          ? (project.input_data?.prompt || "Untitled Project")
          : (project.input_data?.prompt || project.title || "Floorplan Project");
        
        let thumbnail = "/file.svg"; 
        let modelLink = "";

        if (project.workflow_type === "text-to-3d") {
             thumbnail = project.output_data?.image_url || "/file.svg";
             modelLink = project.output_data?.model_url || "";
        } else {
             thumbnail = project.output_data?.isometric_path || project.output_data?.floorplan_path || "/file.svg";
             modelLink = project.output_data?.model_path || "";
        }

        return (
          <div 
            key={project.id} 
            onClick={() => handleProjectClick(project)}
            className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:bg-white/10 transition group cursor-pointer"
          >
            <div className="relative h-48 w-full bg-black/20 flex items-center justify-center">
               {failedImages.has(project.id) || thumbnail === "/file.svg" ? (
                 <div className="text-6xl">{getRandomEmoji(project.workflow_type, project.id)}</div>
               ) : (
                 <>
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img 
                     src={thumbnail} 
                     alt={title} 
                     className="object-cover w-full h-full"
                     onError={() => handleImageError(project.id)}
                   />
                 </>
               )}
               {/* Generation count badge */}
               {project.generation_count && project.generation_count > 1 && (
                 <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                   <span>{project.generation_count}</span>
                   <span className="text-[10px]">generations</span>
                 </div>
               )}
            </div>
            <div className="p-4">
              <h3 className="font-medium truncate text-white" title={title}>{title}</h3>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-white/50 capitalize">{project.workflow_type.replace(/-/g, " ")}</p>
                {project.generation_count && project.generation_count > 1 && (
                  <p className="text-xs text-purple-400">v{project.generation_count}</p>
                )}
              </div>
              
              <div className="mt-4 flex gap-2">
                 {modelLink && (
                     <a 
                       href={modelLink} 
                       target="_blank" 
                       rel="noreferrer" 
                       onClick={(e) => e.stopPropagation()}
                       className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition"
                     >
                        Download 3D
                     </a>
                 )}
                 <span className="text-xs bg-white/10 text-white/70 px-3 py-1.5 rounded">
                   View project
                 </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

