"use client";

import React from "react";
import { Generation } from "@/lib/client-api";

interface GenerationProgressProps {
  generation: Generation;
  showDetails?: boolean;
}

export default function GenerationProgress({
  generation,
  showDetails = true,
}: GenerationProgressProps) {
  const getStatusColor = () => {
    switch (generation.status) {
      case "completed":
        return "bg-green-600";
      case "failed":
        return "bg-red-600";
      case "generating":
        return "bg-blue-600";
      case "pending":
        return "bg-yellow-600";
      default:
        return "bg-gray-600";
    }
  };

  const getStatusIcon = () => {
    switch (generation.status) {
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      case "generating":
        return "⏳";
      case "pending":
        return "⏸️";
      default:
        return "⏳";
    }
  };

  const getStatusText = () => {
    switch (generation.status) {
      case "completed":
        return "Generation completed!";
      case "failed":
        return "Generation failed";
      case "generating":
        return "Generation in progress...";
      case "pending":
        return "Generation pending...";
      default:
        return "Unknown status";
    }
  };

  const getEstimatedTime = (): string | null => {
    if (generation.status === "completed" || generation.status === "failed") {
      return null;
    }

    const progress = generation.progress_percentage || 0;
    if (progress === 0 || progress >= 100) {
      return "Estimating...";
    }

    // Rough estimate: assume 10-15 minutes total for a generation
    const estimatedTotalSeconds = 900; // 15 minutes
    const remainingProgress = 100 - progress;
    if (progress <= 0) {
      return "Estimating...";
    }

    const estimatedSeconds = (remainingProgress / progress) * (estimatedTotalSeconds * progress / 100);

    if (estimatedSeconds < 60) {
      return `~${Math.round(estimatedSeconds)}s remaining`;
    } else if (estimatedSeconds < 3600) {
      return `~${Math.round(estimatedSeconds / 60)}m remaining`;
    } else {
      return `~${Math.round(estimatedSeconds / 3600)}h remaining`;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div>
            <p className="text-sm font-medium text-white">{getStatusText()}</p>
            {showDetails && generation.input_data?.prompt && (
              <p className="text-xs text-white/60 mt-1">
                {generation.input_data.prompt}
              </p>
            )}
          </div>
        </div>
        {generation.status === "generating" || generation.status === "pending" ? (
          <div className="text-right">
            <p className="text-xs text-white/60">Progress</p>
            <p className="text-lg font-semibold text-white">
              {generation.progress_percentage || 0}%
            </p>
          </div>
        ) : null}
      </div>

      {/* Progress Bar */}
      {(generation.status === "generating" || generation.status === "pending") && (
        <div className="space-y-2">
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${getStatusColor()} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${generation.progress_percentage || 0}%` }}
            />
          </div>
          {showDetails && (
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>{getEstimatedTime()}</span>
              <span>{generation.progress_percentage || 0}% complete</span>
            </div>
          )}
        </div>
      )}

      {/* Step-by-Step Progress (for floorplan workflows) */}
      {showDetails && generation.workflow_type === "floorplan-3d" && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {["Image Processing", "3D Generation", "Finalization"].map((step, index) => {
            const currentProgress = generation.progress_percentage || 0;
            const stepProgress = Math.min(
              100,
              Math.max(0, (currentProgress - index * 33.33) * 3)
            );
            const isActive = currentProgress > index * 33.33;
            const isCompleted = currentProgress >= (index + 1) * 33.33;

            return (
              <div
                key={step}
                className={`p-3 rounded-lg border ${isCompleted
                    ? "bg-green-900/20 border-green-500/30"
                    : isActive
                      ? "bg-blue-900/20 border-blue-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isCompleted ? (
                    <span className="text-green-400">✓</span>
                  ) : isActive ? (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-white/30">○</span>
                  )}
                  <span
                    className={`text-xs font-medium ${isActive || isCompleted ? "text-white" : "text-white/40"
                      }`}
                  >
                    {step}
                  </span>
                </div>
                {isActive && !isCompleted && (
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${stepProgress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error Message */}
      {generation.status === "failed" && generation.error_message && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{generation.error_message}</p>
        </div>
      )}
    </div>
  );
}

