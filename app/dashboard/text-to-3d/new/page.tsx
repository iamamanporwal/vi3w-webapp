"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import GenerationProgress from "@/components/workflows/GenerationProgress";
import { useGenerationStatus } from "@/lib/hooks/useGenerationStatus";
import { Generation } from "@/lib/client-api";
import toast from "react-hot-toast";

// Lazy load components to avoid webpack module resolution issues
const TextTo3DFormNotebook = dynamic(
  () => import("@/components/workflows/TextTo3DFormNotebook").then((mod) => mod.default || mod),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-white/60 text-sm">Loading form...</p>
      </div>
    ),
  }
);

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

function TextTo3DNewContent() {
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

  // Prevent hydration mismatch by not rendering content until mounted
  if (!isMounted) {
    return null;
  }

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
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            🎨 Image to 3D Generation
          </h1>
          <p className="text-white/60 text-lg">
            Upload an image or generate one from text, then convert it to a 3D model using Vi3W
          </p>
        </div>

        {/* Two-column layout matching notebook: Left (scale=1) with inputs, Right (scale=2) with 3D viewer */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Left Column: Inputs (scale=1) */}
          <div className="col-span-1">
            <div className="sticky top-8">
              <TextTo3DFormNotebook
                onGenerationStart={handleGenerationStart}
                projectId={projectId}
              />
            </div>
          </div>

          {/* Right Column: 3D Model Viewer (scale=2) */}
          <div className="col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/10">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-semibold">3D Model Viewer</h2>
              </div>
              <div className="w-full h-[600px] bg-gradient-to-br from-black via-gray-900 to-black rounded-lg border border-white/10 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
                <div className="relative z-10 text-center">
                  <svg className="w-24 h-24 mx-auto mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-white/60 text-lg">3D model will appear here after conversion</p>
                  <p className="text-white/40 text-sm mt-2">Your generated 3D model will be interactive and downloadable</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-12 bg-gradient-to-br from-violet-900/20 to-purple-900/20 border border-violet-500/30 rounded-xl p-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Use
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Enter Your Prompt</h3>
                  <p className="text-white/70 text-sm">Type a description of what you want to create (e.g., "A modern chair with wooden legs" or "A 2D floor plan of a 2BHK Flat")</p>
                </div>
              </div>
              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Generate or Upload Image</h3>
                  <p className="text-white/70 text-sm">Click <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">🍑boom</span> to generate an image from your prompt, or upload your own image file (PNG, JPG, WEBP up to 10MB)</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Convert to 3D</h3>
                  <p className="text-white/70 text-sm">Click <span className="font-mono bg-violet-600/30 px-1.5 py-0.5 rounded">Convert to 3D</span> to start the conversion process. This costs 125 credits and takes 5-10 minutes</p>
                </div>
              </div>
              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">View & Download</h3>
                  <p className="text-white/70 text-sm">Once complete, your 3D model will appear in the viewer. You can rotate, zoom, and download it in GLB format</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-white/70">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Image generation is <strong className="text-green-400">FREE</strong></span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>3D conversion costs <strong className="text-violet-400">125 credits</strong></span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span>Processing time: <strong className="text-blue-400">5-10 minutes</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TextTo3DNewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      }
    >
      <TextTo3DNewContent />
    </Suspense>
  );
}
