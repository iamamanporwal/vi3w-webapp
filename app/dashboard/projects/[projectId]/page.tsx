"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { fetchProject, fetchProjectGenerations, fetchGeneration, Project, Generation } from "@/lib/client-api";
import { ArrowLeft, Download, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { SkeletonText } from "@/components/SkeletonLoader";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import ModelViewer from "@/components/workflows/ModelViewer";

function ProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const selectedGenerationId = searchParams.get("generationId");

  const [project, setProject] = useState<Project | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentGeneration, setCurrentGeneration] = useState<Generation | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;

      try {
        setLoading(true);
        setError(null);

        const [projectData, generationsData] = await Promise.all([
          fetchProject(projectId),
          fetchProjectGenerations(projectId)
        ]);

        setProject(projectData);
        // Defensive: Normalize to array in case API returns unexpected format
        const normalizedGenerations = Array.isArray(generationsData) ? generationsData : [];
        setGenerations(normalizedGenerations);

        // Set current generation based on URL param, or default to latest completed/latest
        let selectedGen = null;
        if (selectedGenerationId) {
          selectedGen = normalizedGenerations.find((g: Generation) => g.id === selectedGenerationId);

          // If not found in the list (eventual consistency), try fetching it directly
          if (!selectedGen) {
            try {
              console.log("Generation not found in list, fetching directly:", selectedGenerationId);
              selectedGen = await fetchGeneration(selectedGenerationId);
              // Add to the list if found
              if (selectedGen) {
                setGenerations(prev => [selectedGen!, ...prev]);
              }
            } catch (genError) {
              console.warn("Failed to fetch specific generation:", genError);
            }
          }
        }

        if (!selectedGen) {
          const completed = normalizedGenerations.find((g: Generation) => g.status === "completed");
          const latest = normalizedGenerations[0]; // Already sorted by generation_number desc
          selectedGen = completed || latest || null;
        }
        setCurrentGeneration(selectedGen);

        // Update document title
        if (projectData) {
          document.title = `${projectData.title || projectData.input_data?.prompt || "Project"} | Vi3W`;
        }
      } catch (err) {
        console.error("Error loading project:", err);
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, selectedGenerationId]);

  const handleGenerateNewVersion = () => {
    if (!project) return;

    // Navigate to the appropriate generation page with project_id
    if (project.workflow_type === "text-to-3d") {
      router.push(`/dashboard/text-to-3d/new?projectId=${projectId}`);
    } else {
      router.push(`/dashboard/floorplan-3d/new?projectId=${projectId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <SkeletonText lines={2} className="mb-4" />
            <SkeletonText lines={1} className="w-1/3" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="h-96 bg-white/10 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorDisplay
            error={error || "Project not found"}
            onRetry={() => {
              setError(null);
              const loadData = async () => {
                if (!projectId) return;
                try {
                  setLoading(true);
                  setError(null);
                  const [projectData, generationsData] = await Promise.all([
                    fetchProject(projectId),
                    fetchProjectGenerations(projectId)
                  ]);
                  setProject(projectData);
                  // Defensive: Normalize to array in case API returns unexpected format
                  const normalizedGenerations = Array.isArray(generationsData) ? generationsData : [];
                  setGenerations(normalizedGenerations);
                  const completed = normalizedGenerations.find((g: Generation) => g.status === "completed");
                  const latest = normalizedGenerations[0];
                  setCurrentGeneration(completed || latest || null);
                } catch (err) {
                  console.error("Error loading project:", err);
                  setError(err instanceof Error ? err.message : "Failed to load project");
                } finally {
                  setLoading(false);
                }
              };
              loadData();
            }}
            retryLabel="Reload project"
          />
          <Link
            href="/dashboard"
            className="mt-4 text-purple-400 hover:text-purple-300 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const modelUrl = currentGeneration?.output_data?.model_url ||
    currentGeneration?.output_data?.model_urls?.glb ||
    project.output_data?.model_url ||
    project.output_data?.model_urls?.glb;

  const modelUrls = currentGeneration?.output_data?.model_urls ||
    project.output_data?.model_urls ||
    (modelUrl ? { glb: modelUrl } : undefined);

  const thumbnail = currentGeneration?.output_data?.thumbnail_url ||
    currentGeneration?.output_data?.image_url ||
    project.output_data?.thumbnail_url ||
    project.output_data?.image_url ||
    "/file.svg";

  const modelName = project.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() ||
    `${project.workflow_type.replace(/-/g, '_')}_${project.id.slice(0, 8)}`;

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@google/model-viewer@3.4.0/dist/model-viewer.min.js"
        strategy="lazyOnload"
      />
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="text-white/60 hover:text-white flex items-center gap-2 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>

            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {project.title || project.input_data?.prompt || "Untitled Project"}
                </h1>
                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span className="capitalize">{project.workflow_type.replace(/-/g, " ")}</span>
                  <span>•</span>
                  <span>{project.generation_count || 0} generations</span>
                  <span>•</span>
                  <span>
                    Created {project.created_at?.toDate?.().toLocaleDateString() || "Recently"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerateNewVersion}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg flex items-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Generate New Version
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 3D Model Viewer */}
            <div className="lg:col-span-1">
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">3D Model</h2>

                {currentGeneration?.status === "generating" || currentGeneration?.status === "pending" ? (
                  <div className="flex flex-col items-center justify-center h-96 gap-4">
                    <div className="animate-spin text-purple-400">⏳</div>
                    <div className="text-white/60">Generation in progress...</div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${currentGeneration.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                ) : modelUrl ? (
                  <ModelViewer
                    src={modelUrl}
                    poster={thumbnail}
                    modelUrls={modelUrls}
                    modelName={modelName}
                    alt={project.title || "3D Model"}
                    className="w-full h-96"
                  />
                ) : (
                  <div className="flex items-center justify-center h-96 text-white/60">
                    No 3D model available
                  </div>
                )}

                {/* Current Generation Info */}
                {currentGeneration && (
                  <div className="mt-6 p-4 bg-white/5 rounded-lg">
                    <div className="text-sm text-white/60 mb-2">
                      Generation #{currentGeneration.generation_number || "N/A"}
                    </div>
                    <div className="text-sm">
                      <strong>Prompt:</strong> {currentGeneration.input_data?.prompt || project.input_data?.prompt || "N/A"}
                    </div>
                    {currentGeneration.status === "failed" && currentGeneration.error_message && (
                      <div className="mt-2 text-sm text-red-400">
                        Error: {currentGeneration.error_message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Note: ProjectThreadSidebar is shown in DashboardSidebar on project detail pages */}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <SkeletonText lines={2} className="mb-4" />
          <SkeletonText lines={1} className="w-1/3" />
        </div>
      </div>
    }>
      <ProjectDetailContent />
    </Suspense>
  );
}

