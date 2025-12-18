"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useGeneration } from "@/contexts/GenerationContext";
import { Generation } from "@/lib/api";
import toast from "react-hot-toast";

export default function TextTo3DEditorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const generationId = searchParams.get("generationId");
  const projectId = searchParams.get("projectId"); // Support projectId for continuing existing project
  const { getGeneration } = useGeneration();
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch token
  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (user) {
        const t = await user.getIdToken();
        setToken(t);
        setLoading(false);
      } else {
        setToken(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch generation status if generationId is provided
  useEffect(() => {
    if (!generationId || loading) return;

    let interval: NodeJS.Timeout | null = null;

    const fetchGen = async () => {
      try {
        const gen = await getGeneration(generationId);
        if (gen) {
          setGeneration(gen);
          prevStatusRef.current = gen.status;
          setError(null);
          
          // Show toast for initial status if already completed/failed
          if (gen.status === "completed") {
            toast.success("Generation completed successfully! Your 3D model is ready.");
          } else if (gen.status === "failed") {
            toast.error(
              gen.error_message || "Generation failed. Please try again.",
              { duration: 6000 }
            );
          }
          
          // Poll for updates if generation is active
          if (gen.status === "pending" || gen.status === "generating") {
            interval = setInterval(async () => {
              try {
                const updatedGen = await getGeneration(generationId);
                if (updatedGen) {
                  setGeneration(updatedGen);
                  
                  // Show toast notifications for status changes
                  if (prevStatusRef.current !== updatedGen.status) {
                    if (updatedGen.status === "completed") {
                      toast.success("Generation completed successfully! Your 3D model is ready.");
                    } else if (updatedGen.status === "failed") {
                      toast.error(
                        updatedGen.error_message || "Generation failed. Please try again.",
                        { duration: 6000 }
                      );
                    }
                    prevStatusRef.current = updatedGen.status;
                  }
                  
                  // Stop polling if completed or failed
                  if (updatedGen.status === "completed" || updatedGen.status === "failed") {
                    if (interval) clearInterval(interval);
                  }
                }
              } catch (err) {
                console.error("Error polling generation:", err);
                toast.error("Failed to check generation status");
                if (interval) clearInterval(interval);
              }
            }, 3000); // Poll every 3 seconds
          }
        } else {
          setError("Generation not found");
        }
      } catch (err) {
        console.error("Error fetching generation:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load generation status";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    };

    fetchGen();

    // Cleanup function
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [generationId, loading, getGeneration]);

  // Track generation status for loading overlay
  useEffect(() => {
    if (generation) {
      setIsGenerating(generation.status === "generating" || generation.status === "pending");
    }
  }, [generation]);

  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Generation Status Banner */}
      {generation && (
        <div className={`px-6 py-3 border-b ${
          generation.status === "completed" 
            ? "bg-green-900/20 border-green-500/30" 
            : generation.status === "failed"
            ? "bg-red-900/20 border-red-500/30"
            : "bg-blue-900/20 border-blue-500/30"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {generation.status === "generating" && (
                <span className="animate-spin">⏳</span>
              )}
              {generation.status === "pending" && (
                <span>⏸️</span>
              )}
              {generation.status === "completed" && (
                <span>✅</span>
              )}
              {generation.status === "failed" && (
                <span>❌</span>
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {generation.status === "generating" && "Generation in progress..."}
                  {generation.status === "pending" && "Generation pending..."}
                  {generation.status === "completed" && "Generation completed!"}
                  {generation.status === "failed" && "Generation failed"}
                </p>
                {(generation.status === "generating" || generation.status === "pending") && (
                  <p className="text-xs text-white/60 mt-1">
                    {generation.input_data?.prompt || "Text to 3D"}
                  </p>
                )}
              </div>
            </div>
            {(generation.status === "generating" || generation.status === "pending") && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-white/60">Progress</span>
                  <span className="text-sm font-medium text-white">{generation.progress_percentage}%</span>
                </div>
                <div className="w-32 bg-white/10 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${generation.progress_percentage}%` }}
                  />
                </div>
              </div>
            )}
            {generation.status === "completed" && generation.output_data?.model_url && (
              <a
                href={generation.output_data.model_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded transition"
              >
                Download 3D Model
              </a>
            )}
            {generation.status === "failed" && generation.error_message && (
              <p className="text-xs text-red-400 max-w-md truncate" title={generation.error_message}>
                {generation.error_message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="px-6 py-3 bg-red-900/20 border-b border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Iframe Container with Loading Overlay */}
      <div className="flex-1 bg-black relative" style={{ minHeight: '600px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-white/50">
            Loading editor...
          </div>
        ) : (
          <>
            <iframe 
              src={`${BACKEND_URL}/gradio/text-to-3d/?token=${token || ''}&__theme=dark`}
              className="w-full h-full border-none absolute inset-0"
              style={{ minHeight: '600px' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title="Text to 3D Generator"
            />
            
            {/* Loading Animation Overlay */}
            {isGenerating && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                  {/* Animated 3D cube loader */}
                  <div className="cube-loader">
                    <div className="cube-face front"></div>
                    <div className="cube-face back"></div>
                    <div className="cube-face right"></div>
                    <div className="cube-face left"></div>
                    <div className="cube-face top"></div>
                    <div className="cube-face bottom"></div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Creating Your 3D Model
                  </h3>
                  <p className="text-white/60 text-sm mb-4 max-w-md px-4">
                    {generation?.input_data?.prompt || "Processing your request..."}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-32 bg-white/10 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-violet-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${generation?.progress_percentage || 0}%` }}
                      />
                    </div>
                    <span className="text-white/80 text-sm font-medium">
                      {generation?.progress_percentage || 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
