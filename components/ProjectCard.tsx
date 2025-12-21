"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2 } from "lucide-react";
import { Project } from "@/lib/client-api";
import { getRandomEmoji } from "@/lib/emojiUtils";
import { downloadModel } from "@/lib/client/downloadUtils";

interface ProjectCardProps {
    project: Project;
    onClick: (project: Project) => void;
    index?: number;
}

export function ProjectCard({ project, onClick, index = 0 }: ProjectCardProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const formatDate = (timestamp: any): string => {
        if (!timestamp) return "Unknown";

        let date: Date;
        if (timestamp.toMillis) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return "Unknown";
        }

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    const getProjectTypeLabel = (workflowType: string): string => {
        return workflowType === "text-to-3d" ? "Text to 3D" : "Floorplan 3D";
    };

    const getProjectImage = (project: Project): string => {
        if (project.workflow_type === "text-to-3d") {
            return project.output_data?.image_url || "/file.svg";
        } else {
            return project.output_data?.isometric_path || project.output_data?.floorplan_path || "/file.svg";
        }
    };

    const getProjectTitle = (project: Project): string => {
        if (project.input_data?.prompt) {
            return project.input_data.prompt.length > 30
                ? project.input_data.prompt.substring(0, 30) + "..."
                : project.input_data.prompt;
        }
        return `Project ${project.id}`;
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click navigation

        if (!project.output_data?.model_url && !project.output_data?.model_urls?.glb) {
            alert("Model not available for download");
            return;
        }

        setIsDownloading(true);

        try {
            // Build model URLs object
            const modelUrls = {
                glb: project.output_data?.model_urls?.glb || project.output_data?.model_url,
                fbx: project.output_data?.model_urls?.fbx,
                obj: project.output_data?.model_urls?.obj,
                usdz: project.output_data?.model_urls?.usdz,
            };

            // Generate filename from project title or ID
            const baseName = project.input_data?.prompt
                ? project.input_data.prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')
                : `project_${project.id}`;

            // Download GLB format (most compatible)
            await downloadModel(modelUrls as any, 'glb', baseName);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to download model. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    const thumbnail = getProjectImage(project);
    const showEmoji = imageError || thumbnail === "/file.svg";

    // Check if model is available for download
    const hasModel = project.output_data?.model_url || project.output_data?.model_urls?.glb;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onClick(project)}
            className="group rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:bg-white/10 transition-all hover:scale-[1.02] cursor-pointer"
        >
            <div className="aspect-square relative overflow-hidden bg-black/50 flex items-center justify-center">
                {!imageLoaded && !showEmoji && (
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                )}

                {showEmoji ? (
                    <div className="text-6xl">{getRandomEmoji(project.workflow_type, project.id)}</div>
                ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={thumbnail}
                        alt={getProjectTitle(project)}
                        className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'}`}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => {
                            setImageError(true);
                            setImageLoaded(true);
                        }}
                    />
                )}
                <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-medium border border-white/10">
                    {getProjectTypeLabel(project.workflow_type)}
                </div>

                {/* Download Button */}
                {hasModel && (
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="absolute bottom-3 right-3 p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        title="Download GLB"
                    >
                        {isDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                    </button>
                )}
            </div>
            <div className="p-4">
                <h3 className="font-semibold truncate text-white/90">{getProjectTitle(project)}</h3>
                <p className="text-xs text-white/40 mt-1">{formatDate(project.created_at)}</p>
            </div>
        </motion.div>
    );
}
