"use client";

import React, { Suspense, useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Stage, OrbitControls, useGLTF, Html, Center } from "@react-three/drei";
import { downloadModel } from "@/lib/client/downloadUtils";
import { Loader2 } from "lucide-react";

interface ModelViewerProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
  modelUrls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  modelName?: string;
  onDownload?: (format: string) => void;
}

function Model({ url, onLoad, onError }: { url: string; onLoad: () => void; onError: (err: any) => void }) {
  const { scene } = useGLTF(url, true, true, (loader) => {
    // Optional: caching or manager here
  });
  
  // Trigger onLoad when scene is ready
  React.useEffect(() => {
    onLoad();
  }, [onLoad]);

  // Basic error handling via ErrorBoundary in parent is preferred, 
  // but useGLTF throws, so Suspense + ErrorBoundary catches it.
  
  return <primitive object={scene} />;
}

// Preload the GLTF
useGLTF.preload = (url: string) => useGLTF.preload(url);

export default function ModelViewer({
  src,
  alt = "3D Model",
  className = "",
  modelUrls,
  modelName = "model",
  onDownload,
}: ModelViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Use proxy to avoid CORS issues with external model URLs (like Meshy)
  const proxyUrl = src ? `/api/proxy?url=${encodeURIComponent(src)}` : "";

  // Reset state when src changes
  useEffect(() => {
    setError(null);
    setIsLoaded(false);
  }, [src]);

  // Close download menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = async (format: 'glb' | 'fbx' | 'obj' | 'usdz') => {
    setDownloading(true);
    setShowDownloadMenu(false);
    try {
      // For download, we might want the direct URL if it works, or proxy if not.
      // Usually browser downloads are less strict about CORS than XHR/Fetch in WebGL,
      // but to be safe/consistent we can use proxy or try direct.
      // Let's stick to the urls passed in modelUrls (usually direct) for now, 
      // as downloadUtils likely creates an anchor tag which doesn't need CORS.
      const urls = modelUrls || { glb: src };
      await downloadModel(urls, format, modelName);
      if (onDownload) {
        onDownload(format);
      }
    } catch (error: any) {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const availableFormats = modelUrls ? Object.keys(modelUrls).filter(k => modelUrls[k as keyof typeof modelUrls]) : ['glb'];

  const handleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).msRequestFullscreen) {
        (containerRef.current as any).msRequestFullscreen();
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

  // Safe fallback component for the 3D canvas
  function ErrorFallback({ error, resetErrorBoundary }: any) {
    useEffect(() => {
      console.error("3D Error:", error);
      setError("Failed to load 3D model");
    }, [error]);
    
    return null; // The error UI is handled by the main component state
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-white/10">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
            <span className="text-4xl mb-4">⚠️</span>
            <p className="text-red-400 text-sm mb-2 font-medium">Failed to load 3D model</p>
            <p className="text-white/60 text-xs mb-6 max-w-xs">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setError(null);
                  setIsLoaded(false); // Trigger reload
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded transition border border-white/10"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <Canvas
               shadows
               camera={{ position: [4, 4, 4], fov: 50 }}
               style={{ background: '#000', width: '100%', height: '100%', minHeight: '400px' }}
               dpr={[1, 2]} // Quality scaling
            >
              <Suspense
                fallback={null} // We handle loading state in Html overlay
              >
                <ErrorBoundary onError={() => setError("Unable to render 3D model.")}>
                   <Center>
                     <Stage environment="city" intensity={0.6} adjustCamera={1.2}>
                       <Model 
                          url={proxyUrl} 
                          onLoad={() => setIsLoaded(true)} 
                          onError={() => setError("Unable to load 3D model.")} 
                       />
                     </Stage>
                   </Center>
                </ErrorBoundary>
                <OrbitControls makeDefault autoRotate autoRotateSpeed={2} />
              </Suspense>
            </Canvas>

            {/* Loading Overlay */}
            {!isLoaded && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="text-white/80 text-sm">Loading 3D Model...</p>
                </div>
              </div>
            )}

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
              {/* Download button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  disabled={downloading}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded transition backdrop-blur-sm disabled:opacity-50"
                  title="Download Model"
                >
                  {downloading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  )}
                </button>
                {showDownloadMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl min-w-[120px] overflow-hidden z-20">
                    {availableFormats.map((format) => (
                      <button
                        key={format}
                        onClick={() => handleDownload(format as any)}
                        className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition text-sm uppercase"
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Simple Error Boundary for Canvas
class ErrorBoundary extends React.Component<{ children: React.ReactNode; onError: (error: any) => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
