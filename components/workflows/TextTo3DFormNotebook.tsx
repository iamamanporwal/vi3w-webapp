"use client";

import React, { useState, useCallback } from "react";
import { getAuth } from "@/lib/firebase";
import toast from "react-hot-toast";
import WorkflowForm from "./WorkflowForm";

interface TextTo3DFormNotebookProps {
  onGenerationStart: (genId: string, projId: string) => void;
  projectId?: string | null;
}

export default function TextTo3DFormNotebook({
  onGenerationStart,
  projectId,
}: TextTo3DFormNotebookProps) {
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [status, setStatus] = useState("Ready to convert");
  const [loading, setLoading] = useState(false);

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

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setImagePreview(reader.result as string);
        setStatus("Image uploaded. Ready to convert.");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
      setImageFile(null);
      setImagePreview(null);
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
    if (!prompt.trim()) {
      toast.error("Please enter a prompt first");
      return;
    }

    setGeneratingImage(true);
    setStatus("🔄 Starting image generation...");

    try {
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const token = await user.getIdToken();

      // Step 1: Start generation
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start image generation");
      }

      const data = await response.json();

      if (!data.predictionId) {
        throw new Error("No prediction ID returned from server");
      }

      const predictionId = data.predictionId;
      setStatus("🔄 Image generating... (this may take up to a minute)");

      // Step 2: Poll for status
      const startTime = Date.now();
      const timeout = 60000; // 60 seconds

      const pollInterval = setInterval(async () => {
        try {
          // Check timeout
          if (Date.now() - startTime > timeout) {
            clearInterval(pollInterval);
            setGeneratingImage(false);
            setStatus("❌ Generation timed out. Please try again.");
            toast.error("Generation timed out");
            return;
          }

          const statusResponse = await fetch(`/api/generate-image/status?id=${predictionId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!statusResponse.ok) {
            // Don't stop polling on transient network errors, but log them
            console.warn("Status check failed:", statusResponse.statusText);
            return;
          }

          const statusData = await statusResponse.json();

          if (statusData.status === 'succeeded') {
            clearInterval(pollInterval);

            if (!statusData.output) {
              throw new Error("Generation succeeded but no output returned");
            }

            setGeneratedImageUrl(statusData.output);
            setImagePreview(statusData.output);
            setStatus("✅ Image generated successfully! Ready to convert to 3D.");
            toast.success("Image generated successfully!");
            setGeneratingImage(false);
          } else if (statusData.status === 'failed' || statusData.status === 'canceled') {
            clearInterval(pollInterval);
            setGeneratingImage(false);
            const errorMsg = statusData.error || "Generation failed";
            setStatus(`❌ Error: ${errorMsg}`);
            toast.error(errorMsg);
          } else {
            // Still processing
            setStatus(`🔄 Generating... Status: ${statusData.status}`);
          }
        } catch (error) {
          console.error("Polling error:", error);
          // Don't stop polling on transient errors
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup interval on component unmount is handled by React, 
      // but we should ensure we don't leave it running if the user navigates away
      // (This simple implementation relies on the component staying mounted)

    } catch (error: any) {
      console.error("Error starting generation:", error);
      toast.error(error.message || "Failed to start generation");
      setStatus(`❌ Error: ${error.message || "Failed to start generation"}`);
      setGeneratingImage(false);
    }
  };

  const handleConvertTo3D = async () => {
    if (!imageFile && !imagePreview) {
      toast.error("Please upload or generate an image first");
      return;
    }

    setLoading(true);
    setStatus("🔄 Submitting image for 3D conversion...");

    try {
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const token = await user.getIdToken();
      let imageUrl: string;

      if (imageFile) {
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
          reader.readAsDataURL(imageFile);
        });
      } else if (imagePreview) {
        // If it's a generated image URL, we need to download it and convert to base64
        if (imagePreview.startsWith("http")) {
          try {
            const response = await fetch(imagePreview);
            const blob = await response.blob();
            const reader = new FileReader();
            imageUrl = await new Promise((resolve, reject) => {
              reader.onloadend = () => {
                if (reader.result && typeof reader.result === "string") {
                  resolve(reader.result);
                } else {
                  reject(new Error("Failed to read generated image"));
                }
              };
              reader.onerror = () => reject(new Error("Failed to read generated image"));
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            // Fallback to using the URL directly
            imageUrl = imagePreview;
          }
        } else {
          imageUrl = imagePreview;
        }
      } else {
        throw new Error("No image available");
      }

      const response = await fetch("/api/text-to-3d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompt || "Generate 3D model from image",
          image_url: imageUrl,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to start generation";
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
          // Include more details if available
          if (error.detail) {
            errorMessage += `: ${error.detail}`;
          }
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log("[TextTo3DForm] API Response:", data);
      }

      // Fix: Handle both camelCase and snake_case response formats
      const genId = data.generationId || data.generation_id;
      const projId = data.projectId || data.project_id;

      // Validate response format
      if (!genId || typeof genId !== 'string' || genId.trim().length === 0) {
        console.error("[TextTo3DForm] Invalid generationId in response:", data);
        throw new Error(`Invalid response from server: missing or invalid generationId. Response: ${JSON.stringify(data)}`);
      }

      if (!projId || typeof projId !== 'string' || projId.trim().length === 0) {
        console.error("[TextTo3DForm] Invalid projectId in response:", data);
        throw new Error(`Invalid response from server: missing or invalid projectId. Response: ${JSON.stringify(data)}`);
      }

      setStatus("✅ Generation started! Processing your 3D model...");
      toast.success("3D generation started! This may take 5-10 minutes.");

      // Call the callback with validated IDs
      onGenerationStart(genId, projId);
    } catch (error: any) {
      // Log errors for debugging
      const errorMessage = error.message || "Failed to start generation";
      console.error("[TextTo3DForm] Error converting to 3D:", {
        message: errorMessage,
        error: error,
        stack: error.stack,
      });

      // Show user-friendly error message
      toast.error(errorMessage);
      setStatus(`❌ Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Image Input */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Upload Image
        </label>
        {imagePreview ? (
          <div className="relative w-full h-[400px] bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-full object-contain"
              onLoad={() => {
                // Only log in development
                if (process.env.NODE_ENV === 'development') {
                  console.log("[TextTo3DForm] Image loaded successfully:", imagePreview);
                }
              }}
              onError={(e) => {
                // Only log in development
                if (process.env.NODE_ENV === 'development') {
                  console.error("[TextTo3DForm] Image failed to load:", imagePreview, e);
                }
                toast.error("Failed to load image. The URL may be invalid or expired.");
              }}
            />
            <button
              type="button"
              onClick={() => {
                setImageFile(null);
                setImagePreview(null);
                setGeneratedImageUrl(null);
                setStatus("Ready to convert");
              }}
              className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-full transition transform hover:scale-110 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {generatedImageUrl && (
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-600/80 text-white text-xs rounded flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Generated
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-[400px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${isDragging
              ? "border-blue-500 bg-blue-900/20 scale-105"
              : "border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10"
              } ${generatingImage ? "opacity-50 cursor-wait" : ""}`}
            onClick={() => !generatingImage && document.getElementById("image-input")?.click()}
          >
            <input
              id="image-input"
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              disabled={generatingImage}
            />
            {generatingImage ? (
              <>
                <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
                <p className="text-sm text-white/80 font-medium animate-pulse">Generating your image...</p>
                <p className="text-xs text-white/50 mt-1">This usually takes 10-30 seconds</p>
              </>
            ) : (
              <>
                <svg
                  className={`w-12 h-12 text-white/40 mb-2 transition-transform ${isDragging ? "scale-110" : ""}`}
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
                <p className="text-sm text-white/60">Click to upload or drag and drop</p>
                <p className="text-xs text-white/40 mt-1">PNG, JPG, WEBP up to 10MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Prompt Input */}
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-white mb-2">
          Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt to generate an image (e.g., 'A 2d floor plan of a 2BHK Flat')"
          rows={2}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={loading}
        />
      </div>

      {/* Buttons Row */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleBoom}
          disabled={loading || generatingImage || !prompt.trim()}
          className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 disabled:transform-none"
        >
          {generatingImage ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span>🍑</span>
              <span>boom</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleConvertTo3D}
          disabled={loading || generatingImage || (!imageFile && !imagePreview)}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 disabled:transform-none"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Starting...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Convert to 3D</span>
            </>
          )}
        </button>
      </div>

      {/* Status Textbox */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Status
        </label>
        <div className="relative">
          <textarea
            value={status}
            readOnly
            rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white/80 resize-none transition-all duration-200"
          />
          {(loading || generatingImage) && (
            <div className="absolute right-3 top-3">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

