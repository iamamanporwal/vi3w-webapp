"use client";

import { Generation } from "@/lib/client-api";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

interface ProjectThreadSidebarProps {
  generations: Generation[];
  currentGenerationId: string | null;
  onGenerationClick: (generation: Generation) => void;
}

export function ProjectThreadSidebar({
  generations,
  currentGenerationId,
  onGenerationClick,
}: ProjectThreadSidebarProps) {
  const formatRelativeTime = (timestamp: any): string => {
    if (!timestamp) return "Recently";

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "generating":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-white/40" />;
    }
  };

  const truncatePrompt = (prompt: string | undefined, maxLength: number = 50): string => {
    if (!prompt) return "No prompt";
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + "...";
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 h-full">
      <h2 className="text-xl font-semibold mb-4">Generation History</h2>

      {generations.length === 0 ? (
        <div className="text-white/60 text-sm text-center py-8">
          No generations yet
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Git-like vertical timeline */}
          <div className="relative pl-6 border-l-2 border-white/10">
            {generations.map((gen, index) => {
              const isActive = currentGenerationId === gen.id;
              const isLast = index === generations.length - 1;

              return (
                <div key={gen.id} className="relative mb-4">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 ${isActive
                        ? "bg-purple-500 border-purple-400"
                        : gen.status === "completed"
                          ? "bg-green-500 border-green-400"
                          : gen.status === "failed"
                            ? "bg-red-500 border-red-400"
                            : "bg-yellow-500 border-yellow-400"
                      }`}
                  />

                  {/* Generation card */}
                  <button
                    onClick={() => onGenerationClick(gen)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${isActive
                        ? "bg-purple-500/20 border border-purple-500/50 shadow-lg shadow-purple-500/10"
                        : "bg-white/5 hover:bg-white/10 border border-transparent"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-purple-400">
                          v{gen.generation_number || "?"}
                        </span>
                        {getStatusIcon(gen.status)}
                      </div>
                      <span className="text-xs text-white/40">
                        {formatRelativeTime(gen.created_at)}
                      </span>
                    </div>

                    <div className="text-xs text-white/70 mb-2 line-clamp-2">
                      {truncatePrompt(gen.input_data?.prompt)}
                    </div>

                    {/* Progress bar for active generations */}
                    {(gen.status === "generating" || gen.status === "pending") && (
                      <div className="mt-2">
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${gen.progress_percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          {gen.progress_percentage}% complete
                        </div>
                      </div>
                    )}

                    {/* Error message for failed generations */}
                    {gen.status === "failed" && gen.error_message && (
                      <div className="mt-2 text-xs text-red-400 line-clamp-1" title={gen.error_message}>
                        {gen.error_message}
                      </div>
                    )}
                  </button>

                  {/* Timeline line (not for last item) */}
                  {!isLast && (
                    <div className="absolute -left-[1px] top-8 w-0.5 h-4 bg-white/10" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

