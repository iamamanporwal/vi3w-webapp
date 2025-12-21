"use client";

import React, { useState, useRef, useEffect } from "react";



interface ModelViewerProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
  onDownload?: () => void;
}

export default function ModelViewer({
  src,
  alt = "3D Model",
  poster,
  className = "",
  onDownload,
}: ModelViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    // Load model-viewer script dynamically
    if (typeof window !== "undefined" && !isLoaded) {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="model-viewer"]');
      if (existingScript) {
        setIsLoaded(true);
        return;
      }

      const script = document.createElement("script");
      script.type = "module";
      script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js";
      script.onload = () => setIsLoaded(true);
      script.onerror = () => {
        setError("Failed to load 3D viewer library");
        setIsLoaded(false);
      };
      document.head.appendChild(script);

      return () => {
        // Only remove if we added it
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, [isLoaded]);

  const handleFullscreen = () => {
    if (!viewerRef.current) return;

    if (!isFullscreen) {
      if (viewerRef.current.requestFullscreen) {
        viewerRef.current.requestFullscreen();
      } else if ((viewerRef.current as any).webkitRequestFullscreen) {
        (viewerRef.current as any).webkitRequestFullscreen();
      } else if ((viewerRef.current as any).msRequestFullscreen) {
        (viewerRef.current as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-white/10">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
            <span className="text-4xl mb-4">⚠️</span>
            <p className="text-red-400 text-sm mb-2 font-medium">Failed to load 3D model</p>
            <p className="text-white/60 text-xs mb-6 max-w-xs">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setIsLoaded(false); // Trigger reload of script/viewer
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded transition border border-white/10"
              >
                Retry
              </button>
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition"
                >
                  Download Model
                </button>
              )}
            </div>
          </div>
        ) : !isLoaded ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
            <p className="text-white/60 text-sm">Loading 3D viewer...</p>
          </div>
        ) : (
          <>
            {/* @ts-ignore */}
            <model-viewer
              ref={viewerRef}
              src={src}
              alt={alt}
              poster={poster}
              loading="lazy"
              auto-rotate="true"
              camera-controls="true"
              shadow-intensity="1"
              interaction-prompt="none"
              style={{
                width: "100%",
                height: "100%",
                minHeight: "400px",
                backgroundColor: "#000",
              }}
              onError={(e: any) => {
                console.error("Model viewer error:", e);
                const errorMessage = e?.detail?.message ||
                  e?.message ||
                  "Failed to load 3D model. The file may be corrupted or unsupported.";
                setError(errorMessage);
              }}
              onLoad={() => {
                setError(null);
              }}
            />

            {/* Controls Overlay */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <button
                onClick={handleFullscreen}
                className="p-2 bg-black/50 hover:bg-black/70 text-white rounded transition backdrop-blur-sm"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                )}
              </button>
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded transition backdrop-blur-sm"
                  title="Download Model"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

