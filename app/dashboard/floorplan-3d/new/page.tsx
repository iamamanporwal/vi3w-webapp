"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import WorkflowForm from "@/components/workflows/WorkflowForm";
import Floorplan3DForm from "@/components/workflows/Floorplan3DForm";
import Floorplan3DFormNotebook from "@/components/workflows/Floorplan3DFormNotebook";
import GenerationProgress from "@/components/workflows/GenerationProgress";
import { useGenerationStatus } from "@/lib/hooks/useGenerationStatus";
import { Generation } from "@/lib/client-api";
import toast from "react-hot-toast";

// Lazy load ModelViewer - only load when needed
const ModelViewer = dynamic(() => import("@/components/workflows/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
      <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
      <p className="text-white/60 text-sm">Loading 3D viewer...</p>
    </div>
  ),
});

function Floorplan3DNewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const generationId = searchParams.get("generationId");
  const projectId = searchParams.get("projectId");
  const [isMounted, setIsMounted] = useState(false);

  // Handle initial state and hydration
  useEffect(() => {
    setIsMounted(true);
    if (generationId && projectId) {
      router.replace(`/dashboard/projects/${projectId}?generationId=${generationId}`);
    }
  }, [generationId, projectId, router]);

  if (!isMounted) return null;

  const handleGenerationStart = (genId: string, projId: string) => {
    // Redirect to project page
    router.push(`/dashboard/projects/${projId}?generationId=${genId}`);
  };

  // If we have a generationId, show loading while redirecting
  if (generationId) {
    return (
      <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Redirecting to project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">Vi3W - Floorplan to 3D</h1>
        <p className="text-white/60 mb-8 text-center">
          Transform 2D floor plans into stunning 3D models with AI
        </p>

        {/* Three-column layout matching notebook */}
        <Floorplan3DFormNotebook
          onModelGenerated={(generationId, projectId) => {
            // Handle model generation - navigate to generation view
            handleGenerationStart(generationId, projectId);
          }}
          projectId={projectId}
        />

        {/* Footer with instructions */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <h3 className="text-lg font-semibold mb-4">🔧 How it works:</h3>
          <ol className="list-decimal list-inside space-y-2 text-white/80 text-sm">
            <li><strong>Upload Floor Plan</strong>: Upload your existing 2D floor plan image</li>
            <li><strong>Isometric Conversion</strong>: The 2D plan is converted to a 3D isometric view using AI</li>
            <li><strong>3D Model Generation</strong>: Using TRELLIS AI, the isometric view becomes a full 3D GLB model</li>
            <li><strong>Interactive Viewing</strong>: Explore your 3D model with enhanced viewing controls</li>
          </ol>
          <p className="mt-4 text-xs text-white/60">
            <strong>Supported formats</strong>: PNG, JPG for input | GLB for 3D output | MP4 for preview videos
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Floorplan3DNewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      }
    >
      <Floorplan3DNewContent />
    </Suspense>
  );
}
