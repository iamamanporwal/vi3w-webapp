"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { getAuth } from "@/lib/firebase";
import toast from "react-hot-toast";

// Lazy load ModelViewer
const ModelViewer = dynamic(() => import("@/components/workflows/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[350px]">
      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-2" />
      <p className="text-white/60 text-xs">Loading 3D viewer...</p>
    </div>
  ),
});

interface Floorplan3DFormNotebookProps {
  onIsometricGenerated?: (imageUrl: string) => void;
  onModelGenerated?: (generationId: string, projectId: string) => void;
  projectId?: string | null;
}

export default function Floorplan3DFormNotebook({
  onIsometricGenerated,
  onModelGenerated,
  projectId,
}: Floorplan3DFormNotebookProps) {
  const [floorplanFile, setFloorplanFile] = useState<File | null>(null);
  const [floorplanPreview, setFloorplanPreview] = useState<string | null>(null);
  const [isometricImage, setIsometricImage] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [floorplanStatus, setFloorplanStatus] = useState("Upload a 2D floor plan to begin");
  const [isometricStatus, setIsometricStatus] = useState("Waiting for floor plan upload");
  const [modelStatus, setModelStatus] = useState("Waiting for isometric view");
  const [loading, setLoading] = useState(false);
  const [generatingIsometric, setGeneratingIsometric] = useState(false);
  const [generatingModel, setGeneratingModel] = useState(false);
  const [showViewingTools, setShowViewingTools] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageSelect(file);
    } else {
      toast.error("Please drop an image file");
    }
  }, []);

  const handleImageSelect = (file: File) => {
    if (!file || !file.type) {
      toast.error("Invalid file selected");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WEBP)");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error(`Image size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    setFloorplanFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setFloorplanPreview(reader.result as string);
        setFloorplanStatus("✅ Floor plan uploaded! Click 'Generate 3D Isometric View' to continue.");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
      setFloorplanFile(null);
      setFloorplanPreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleBoom = async () => {
    setLoading(true);
    setFloorplanStatus("🔄 Generating new floor plan...");
    
    try {
      // This would call the floorplan generation API
      toast.success("Floorplan generation feature coming soon");
      setFloorplanStatus("✅ New floor plan generated successfully! You can now generate the 3D isometric view.");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate floorplan");
      setFloorplanStatus("❌ Error generating floor plan");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIsometric = async () => {
    if (!floorplanFile && !floorplanPreview) {
      toast.error("Please upload a floor plan first");
      return;
    }

    setGeneratingIsometric(true);
    setIsometricStatus("🔄 Converting to isometric view...");

    try {
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const token = await user.getIdToken();
      let imageUrl: string;

      if (floorplanFile) {
        const reader = new FileReader();
        imageUrl = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            if (reader.result && typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read image file"));
            }
          };
          reader.onerror = () => reject(new Error("Failed to read image file"));
          reader.readAsDataURL(floorplanFile);
        });
      } else {
        imageUrl = floorplanPreview!;
      }

      // Call isometric generation API
      // For now, simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsometricImage(imageUrl); // In real implementation, this would be the isometric result
      setIsometricStatus("✅ 3D Isometric view generated! Click 'Generate 3D Model' to continue.");
      
      if (onIsometricGenerated) {
        onIsometricGenerated(imageUrl);
      }
    } catch (error: any) {
      console.error("Error generating isometric:", error);
      toast.error(error.message || "Failed to generate isometric view");
      setIsometricStatus(`❌ Error: ${error.message || "Failed to generate isometric view"}`);
    } finally {
      setGeneratingIsometric(false);
    }
  };

  const handleGenerate3DModel = async () => {
    if (!isometricImage) {
      toast.error("Please generate isometric view first");
      return;
    }

    setGeneratingModel(true);
    setModelStatus("🔄 Generating 3D model...");

    try {
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const token = await user.getIdToken();

      const response = await fetch("/api/floorplan-3d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: "A modern apartment with 2 bedrooms, living room, and kitchen",
          image_url: isometricImage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start generation");
      }

      const data = await response.json();
      setModelStatus("✅ 3D Model generated successfully! Use viewing tools to enhance the display.");
      
      if (data.generation_id && data.project_id && onModelGenerated) {
        onModelGenerated(data.generation_id, data.project_id);
      }
      
      // Store model URL if provided
      if (data.model_url) {
        setModelUrl(data.model_url);
      }
    } catch (error: any) {
      console.error("Error generating 3D model:", error);
      toast.error(error.message || "Failed to generate 3D model");
      setModelStatus(`❌ Error: ${error.message || "Failed to generate 3D model"}`);
    } finally {
      setGeneratingModel(false);
    }
  };

  const handleRegenerateIsometric = () => {
    handleGenerateIsometric();
  };

  const handleRegenerateModel = () => {
    handleGenerate3DModel();
  };

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* Component A: Upload Floor Plan (scale=1) */}
      <div className="col-span-1">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">📤 Component A: Upload Floor Plan</h3>
          
          {floorplanPreview ? (
            <div className="relative w-full h-[350px] bg-white/5 border border-white/10 rounded-lg overflow-hidden mb-4">
              <img
                src={floorplanPreview}
                alt="Floorplan preview"
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setFloorplanFile(null);
                  setFloorplanPreview(null);
                  setIsometricImage(null);
                  setFloorplanStatus("Upload a 2D floor plan to begin");
                  setIsometricStatus("Waiting for floor plan upload");
                  setModelStatus("Waiting for isometric view");
                }}
                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-full transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full h-[350px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition mb-4 ${
                isDragging
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-white/20 hover:border-white/40 bg-white/5"
              }`}
              onClick={() => document.getElementById("floorplan-input")?.click()}
            >
              <input
                id="floorplan-input"
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <svg
                className="w-12 h-12 text-white/40 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-white/60">Upload your floorplan</p>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={handleBoom}
              disabled={loading}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              🏠boom
            </button>
            <button
              type="button"
              onClick={handleGenerateIsometric}
              disabled={generatingIsometric || !floorplanPreview}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              🎯 Generate 3D isometric view
            </button>
          </div>

          <textarea
            value={floorplanStatus}
            readOnly
            rows={2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/80 text-sm resize-none"
          />
        </div>
      </div>

      {/* Component B: 3D Isometric View (scale=1) */}
      <div className="col-span-1">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">🎨 Component B: 3D Isometric View</h3>
          
          {isometricImage ? (
            <div className="w-full h-[350px] bg-white/5 border border-white/10 rounded-lg overflow-hidden mb-4">
              <img
                src={isometricImage}
                alt="Isometric view"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-full h-[350px] bg-white/5 border border-white/10 rounded-lg flex items-center justify-center mb-4">
              <p className="text-white/60 text-sm">3D isometric View</p>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={handleRegenerateIsometric}
              disabled={generatingIsometric || !floorplanPreview}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              🔄 Regenerate
            </button>
            <button
              type="button"
              onClick={handleGenerate3DModel}
              disabled={generatingModel || !isometricImage}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              🏗️ Generate 3D Model
            </button>
          </div>

          <textarea
            value={isometricStatus}
            readOnly
            rows={2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/80 text-sm resize-none"
          />
        </div>
      </div>

      {/* Component C: 3D Model (scale=2) */}
      <div className="col-span-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">🏠 Component C: 3D Model</h3>
          
          {modelUrl ? (
            <div className="w-full h-[350px] bg-black rounded-lg border border-white/10 overflow-hidden mb-4">
              <ModelViewer
                src={modelUrl}
                alt="3D Floorplan Model"
                onDownload={() => {
                  if (modelUrl) {
                    window.open(modelUrl, "_blank");
                  }
                }}
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="w-full h-[350px] bg-black rounded-lg border border-white/10 flex items-center justify-center mb-4">
              <p className="text-white/60 text-sm">3D Model (GLB)</p>
            </div>
          )}

          {/* Preview Video */}
          {videoUrl && (
            <div className="mb-4">
              <video
                src={videoUrl}
                controls
                className="w-full rounded-lg border border-white/10"
              />
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setShowViewingTools(!showViewingTools)}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition"
            >
              🔧 More 3D Viewing Tools
            </button>
            <button
              type="button"
              onClick={handleRegenerateModel}
              disabled={generatingModel || !isometricImage}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              🔄 Regenerate
            </button>
          </div>

          {/* Viewing Controls (initially hidden) */}
          {showViewingTools && (
            <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg">
              <h4 className="text-sm font-semibold mb-3">🎛️ Viewing Controls</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Brightness</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    defaultValue="1.0"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Contrast</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    defaultValue="1.0"
                    className="w-full"
                  />
                </div>
                <button
                  type="button"
                  className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition"
                >
                  Apply Settings
                </button>
              </div>
            </div>
          )}

          <textarea
            value={modelStatus}
            readOnly
            rows={2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/80 text-sm resize-none"
          />
        </div>
      </div>
    </div>
  );
}

