"use client";

export const dynamic = 'force-dynamic';

import React, { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { SkeletonText } from "@/components/SkeletonLoader";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { useGenerationQuery, useProjectQuery, useProjectGenerationsQuery } from "@/lib/queries";
import nextDynamic from "next/dynamic";

const ModelViewer = nextDynamic(() => import("@/components/workflows/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 flex flex-col items-center justify-center bg-white/5 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-2" />
      <span className="text-white/60">Loading 3D Viewer...</span>
    </div>
  ),
});

function ProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const selectedGenerationId = searchParams.get("generationId");

  // Fetch project data
  const {
    data: project,
    isLoading: isLoadingProject,
    error: projectError,
    refetch: refetchProject
  } = useProjectQuery(projectId);

  // Fetch project generations
  const {
    data: generations = [],
    isLoading: isLoadingGenerations,
    error: generationsError,
  } = useProjectGenerationsQuery(projectId);

  // Fetch specific generation if selectedGenerationId exists
  const {
    data: fetchedGeneration,
    isLoading: isLoadingGeneration,
    error: generationError
  } = useGenerationQuery("CZbJtXoJpF0OTp8YrquI");

  // Determine current generation to display
  const currentGeneration = React.useMemo(() => {
    // 1. If we have a specific generation ID in the URL, try to find it
    if (selectedGenerationId) {
      const fromList = generations.find(g => g.id === selectedGenerationId);
      if (fromList) return fromList;
    }

    // 2. If we have a fetched generation (either from URL or hardcoded/fetched by hook), use it
    if (fetchedGeneration) return fetchedGeneration;

    // 3. Fallback to completions or first from the generations list
    const completed = generations.find(g => g.status === "completed");
    return completed || generations[0] || null;
  }, [selectedGenerationId, generations, fetchedGeneration]);

  // Update document title
  React.useEffect(() => {
    if (project) {
      document.title = `${project.title || project.input_data?.prompt || "Project"} | Vi3W`;
    }
  }, [project]);

  const handleGenerateNewVersion = () => {
    if (!project) return;

    // Navigate to the appropriate generation page with project_id
    if (project.workflow_type === "text-to-3d") {
      router.push(`/dashboard/text-to-3d/new?projectId=${projectId}`);
    } else {
      router.push(`/dashboard/floorplan-3d/new?projectId=${projectId}`);
    }
  };

  const isLoading = isLoadingProject || isLoadingGenerations || isLoadingGeneration;
  const error = projectError || generationsError || generationError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <SkeletonText lines={2} className="mb-4" />
            <SkeletonText lines={1} className="w-1/3" />
          </div>
          {isLoadingGeneration && (
            <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-300">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading generation data...</span>
              </div>
            </div>
          )}
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
            error={error instanceof Error ? error.message : "Project not found"}
            onRetry={() => refetchProject()}
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

  console.log(currentGeneration);
  console.log("gene",fetchedGeneration);

  const modelUrl = currentGeneration?.output_data?.model_url ||
    currentGeneration?.output_data?.model_urls?.glb ||
    project?.output_data?.model_url ||
    project?.output_data?.model_urls?.glb;

  const modelUrls = currentGeneration?.output_data?.model_urls ||
    project?.output_data?.model_urls ||
    (modelUrl ? { glb: modelUrl } : undefined);

  const thumbnail = currentGeneration?.output_data?.thumbnail_url ||
    currentGeneration?.output_data?.image_url ||
    project?.output_data?.thumbnail_url ||
    project?.output_data?.image_url ||
    "/file.svg";

  const modelName = project?.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() ||
    `${project?.workflow_type.replace(/-/g, '_')}_${project?.id.slice(0, 8)}`;

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
                  {project?.title || project?.input_data?.prompt || "Untitled Project"}
                </h1>
                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span className="capitalize">{project?.workflow_type.replace(/-/g, " ")}</span>
                  <span>•</span>
                  <span>{project?.generation_count || 0} generations</span>
                  <span>•</span>
                  <span>
                    Created {project?.created_at?.toDate?.().toLocaleDateString() || "Recently"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerateNewVersion}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg flex items-center gap-2 transition"
              >
                {isLoading ? (
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
                    alt={project?.title || "3D Model"}
                    className="w-full h-96"
                  />
                ) : (
                  <div className="flex items-center justify-center h-96 text-white/60">
                    {/* No 3D model available */}
                  </div>
                )}

                {/* Current Generation Info */}
                {currentGeneration && (
                  <div className="mt-6 p-4 bg-white/5 rounded-lg">
                    <div className="text-sm text-white/60 mb-2">
                      Generation #{currentGeneration.generation_number || "N/A"}
                    </div>
                    <div className="text-sm">
                      <strong>Prompt:</strong> {currentGeneration.input_data?.prompt || project?.input_data?.prompt || "N/A"}
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
