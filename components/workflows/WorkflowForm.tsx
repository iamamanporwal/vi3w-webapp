"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "@/lib/firebase";
import toast from "react-hot-toast";

interface WorkflowFormProps {
  children: React.ReactNode;
  onSubmit?: (data: any) => Promise<{ generationId: string; projectId: string }>;
  workflowType: "text-to-3d" | "floorplan-3d";
  projectId?: string | null;
  onGenerationStart?: (generationId: string, projectId: string) => void;
}

interface CreditCheck {
  credits: number;
  loading: boolean;
  error: string | null;
}

export default function WorkflowForm({
  children,
  onSubmit,
  workflowType,
  projectId,
  onGenerationStart,
}: WorkflowFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creditCheck, setCreditCheck] = useState<CreditCheck>({
    credits: 0,
    loading: true,
    error: null,
  });
  const [error, setError] = useState<string | null>(null);

  // Check credits on mount and when user changes
  useEffect(() => {
    checkCredits();
    
    // Set up interval to refresh credits every 30 seconds
    const interval = setInterval(() => {
      checkCredits();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkCredits = async () => {
    try {
      setCreditCheck((prev) => ({ ...prev, loading: true, error: null }));
      const user = getAuth().currentUser;
      if (!user) {
        setCreditCheck({ credits: 0, loading: false, error: "Not authenticated" });
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch("/api/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to check credits");
      }

      const data = await res.json();
      setCreditCheck({
        credits: data.credits || 0,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error("Error checking credits:", err);
      setCreditCheck({
        credits: 0,
        loading: false,
        error: err.message || "Failed to check credits",
      });
    }
  };

  const handleSubmit = async (formData: any) => {
    if (creditCheck.credits < 125) {
      toast.error("Insufficient credits. You need at least 125 credits to generate a 3D model.", {
        duration: 5000,
      });
      router.push("/dashboard/credits");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Make API call based on workflow type
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const token = await user.getIdToken();
      const apiRoute = workflowType === "text-to-3d" ? "/api/text-to-3d" : "/api/floorplan-3d";
      
      const requestBody: Record<string, any> = {
        ...formData,
      };

      // Add projectId if provided
      if (projectId) {
        requestBody.projectId = projectId;
      }

      // Convert imageUrl to imagePath for API
      if (formData.imageUrl) {
        requestBody.imagePath = formData.imageUrl;
        delete requestBody.imageUrl;
      }

      // Ensure prompt is a string
      if (requestBody.prompt && typeof requestBody.prompt !== "string") {
        requestBody.prompt = String(requestBody.prompt);
      }

      const res = await fetch(apiRoute, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(error.error || error.detail || "Generation failed");
      }

      const result = await res.json();
      
      if (onGenerationStart) {
        onGenerationStart(result.generationId, result.projectId);
      }

      // Navigate to the generation page with the generation ID
      const workflowPath = workflowType === "text-to-3d" ? "text-to-3d" : "floorplan-3d";
      router.push(
        `/dashboard/${workflowPath}/new?generationId=${result.generationId}&projectId=${result.projectId}`
      );
    } catch (err: any) {
      console.error("Error submitting form:", err);
      const errorMessage = err.message || "Failed to start generation";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Credit Check Display */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        {creditCheck.loading ? (
          <div className="flex items-center gap-2 text-white/60">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Checking credits...</span>
          </div>
        ) : creditCheck.error ? (
          <div className="flex items-center gap-2 text-red-400">
            <span>⚠️</span>
            <span className="text-sm">{creditCheck.error}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Available Credits</p>
              <p className="text-2xl font-bold text-white">{creditCheck.credits}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/60">Cost per Generation</p>
              <p className="text-xl font-semibold text-white">125 credits</p>
            </div>
            {creditCheck.credits < 125 && (
              <div className="flex items-center gap-2 text-yellow-400">
                <span>⚠️</span>
                <span className="text-sm">Insufficient credits</span>
                <button
                  onClick={() => router.push("/dashboard/credits")}
                  className="ml-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded transition"
                >
                  Buy Credits
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Form Content */}
      <div className="space-y-6">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onSubmit: handleSubmit,
              loading,
              disabled: loading || creditCheck.credits < 125,
              projectId,
            });
          }
          return child;
        })}
      </div>
    </div>
  );
}

