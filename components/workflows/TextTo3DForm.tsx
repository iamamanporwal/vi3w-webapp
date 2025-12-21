"use client";

import React, { useState, useCallback } from "react";
import { getAuth } from "@/lib/firebase";
import toast from "react-hot-toast";

interface TextTo3DFormProps {
  onSubmit: (data: { prompt: string; imageUrl?: string }) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  projectId?: string | null;
}

export default function TextTo3DForm({
  onSubmit,
  loading = false,
  disabled = false,
  projectId,
}: TextTo3DFormProps) {
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error(`Image size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    // Check minimum size (1KB)
    if (file.size < 1024) {
      toast.error("Image file is too small");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setImagePreview(reader.result as string);
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

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const uploadImage = async (file: File): Promise<string> => {
    setUploadingImage(true);
    try {
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Convert to data URL
      // In production, you should upload to Firebase Storage or similar
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read image file"));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!prompt.trim() && !imageFile) {
      toast.error("Please enter a text prompt or upload an image");
      return;
    }

    if (prompt.trim().length > 1000) {
      toast.error("Prompt is too long. Please keep it under 1000 characters.");
      return;
    }

    if (loading || disabled) return;

    try {
      let imageUrl: string | undefined;
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      // Call the parent's onSubmit with form data
      await onSubmit({
        prompt: prompt.trim() || "Generate 3D model from image",
        imageUrl,
      });
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast.error(error.message || "Failed to start generation");
    }
  };

  return (
    <div className="space-y-6">
      {/* Text Input */}
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-white mb-2">
          Text Prompt <span className="text-white/60">(optional if image provided)</span>
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the 3D model you want to create... (e.g., 'A red sports car', 'A modern chair with wooden legs')"
          rows={4}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={loading || disabled}
        />
        <p className="mt-1 text-xs text-white/60">
          {prompt.length} characters
        </p>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Image Upload <span className="text-white/60">(optional)</span>
        </label>
        
        {imagePreview ? (
          <div className="relative">
            <div className="relative w-full h-64 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-full transition"
                disabled={loading || disabled}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-xs text-white/60">
              {imageFile?.name} ({(imageFile?.size || 0) / 1024} KB)
            </p>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition ${
              isDragging
                ? "border-blue-500 bg-blue-900/20"
                : "border-white/20 hover:border-white/40 bg-white/5"
            } ${loading || disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => {
              if (!loading && !disabled) {
                document.getElementById("image-input")?.click();
              }
            }}
          >
            <input
              id="image-input"
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              disabled={loading || disabled}
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
            <p className="text-sm text-white/60 mb-1">
              Drag and drop an image here, or click to select
            </p>
            <p className="text-xs text-white/40">
              PNG, JPG, WEBP up to 10MB
            </p>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || disabled || uploadingImage || (!prompt.trim() && !imageFile)}
        className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {uploadingImage ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Uploading image...</span>
          </>
        ) : loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Starting generation...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>Generate 3D Model</span>
          </>
        )}
      </button>

      {projectId && (
        <p className="text-xs text-white/60 text-center">
          This will create a new version of your existing project
        </p>
      )}
    </div>
  );
}

