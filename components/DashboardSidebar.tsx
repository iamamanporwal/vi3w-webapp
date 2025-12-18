"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutGrid, 
  Box, 
  Layers, 
  History, 
  CreditCard,
  ChevronRight,
  ChevronLeft,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ProjectThreadSidebar } from "./ProjectThreadSidebar";
import { fetchProjectGenerations, Generation } from "@/lib/api";

const sidebarItems = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutGrid,
    variant: "default"
  },
  {
    title: "Text to 3D",
    href: "/dashboard/text-to-3d",
    icon: Box,
    variant: "workflow"
  },
  {
    title: "Floorplan to 3D",
    href: "/dashboard/floorplan-3d",
    icon: Layers,
    variant: "workflow"
  },
  {
    title: "Credits",
    href: "/dashboard/credits",
    icon: CreditCard,
    variant: "default"
  }
];

interface DashboardSidebarProps {
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}

function DashboardSidebarContent({ isCollapsed = false, setIsCollapsed }: DashboardSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  
  // Check if we're on a project detail page
  const isProjectDetailPage = pathname?.startsWith("/dashboard/projects/");
  const projectId = isProjectDetailPage ? (params?.projectId as string) : null;
  
  // Project thread state
  const [generations, setGenerations] = useState<Generation[]>([]);
  const currentGenerationId = searchParams?.get("generationId");
  const [threadLoading, setThreadLoading] = useState(false);

  // Fetch credit balance from Firestore
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) {
        setCredits(null);
        setCreditsLoading(false);
        return;
      }

      try {
        setCreditsLoading(true);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCredits(userData?.credits || 0);
        } else {
          setCredits(0);
        }
      } catch (error) {
        console.error("Error fetching credits:", error);
        setCredits(0);
      } finally {
        setCreditsLoading(false);
      }
    };

    fetchCredits();
  }, [user]);

  // Fetch project generations when on project detail page
  useEffect(() => {
    if (!isProjectDetailPage || !projectId || !user) {
      setGenerations([]);
      return;
    }

    const loadGenerations = async () => {
      try {
        setThreadLoading(true);
        const gens = await fetchProjectGenerations(projectId);
        setGenerations(gens);
        // If no generationId in URL, set default (but don't navigate - let page handle it)
        // The page will read from URL or use default
      } catch (error) {
        console.error("Error loading project generations:", error);
        setGenerations([]);
      } finally {
        setThreadLoading(false);
      }
    };

    loadGenerations();
  }, [isProjectDetailPage, projectId, user]);

  const handleGenerationClick = (generation: Generation) => {
    // Update URL with generationId query param
    if (projectId) {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("generationId", generation.id);
      router.push(`/dashboard/projects/${projectId}?${params.toString()}`);
    }
  };

  // Show ProjectThreadSidebar on project detail pages
  if (isProjectDetailPage && projectId) {
    return (
      <aside 
        className={cn(
          "fixed left-0 top-[80px] bottom-0 border-r border-white/10 bg-black/50 backdrop-blur-xl hidden md:flex flex-col transition-all duration-300",
          isCollapsed ? "w-20" : "w-80"
        )}
      >
        <div className="p-4 flex flex-col gap-2 h-full overflow-hidden">
          {/* Back button */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {!isCollapsed && <span className="text-sm">Back to Dashboard</span>}
          </Link>
          
          {/* Project Thread Sidebar */}
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              {threadLoading ? (
                <div className="text-white/60 text-sm text-center py-8">Loading...</div>
              ) : (
                <ProjectThreadSidebar
                  generations={generations}
                  currentGenerationId={currentGenerationId}
                  onGenerationClick={handleGenerationClick}
                />
              )}
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Normal navigation sidebar
  return (
    <aside 
      className={cn(
        "fixed left-0 top-[80px] bottom-0 border-r border-white/10 bg-black/50 backdrop-blur-xl hidden md:flex flex-col transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="p-4 flex flex-col gap-2">
        <div className={cn(
          "flex items-center justify-between mb-2 px-3",
          isCollapsed ? "justify-center" : ""
        )}>
          {!isCollapsed && (
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Workflows
            </div>
          )}
          {setIsCollapsed && (
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-white/40 hover:text-white transition-colors"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>
        
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                isActive 
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5",
                isCollapsed ? "justify-center" : ""
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-purple-400" : "text-white/40 group-hover:text-white")} />
              {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">{item.title}</span>}
              {!isCollapsed && isActive && <ChevronRight className="w-4 h-4 ml-auto text-purple-400/50" />}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto p-4 border-t border-white/10">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2 text-white/40 text-sm mb-3">
               <CreditCard className="w-4 h-4" />
               <span>Credits</span>
            </div>
            <div className="px-3 py-2">
                <div className="text-2xl font-bold text-white mb-1">
                  {creditsLoading ? "..." : credits !== null ? credits.toLocaleString() : 0}
                </div>
                <div className="text-xs text-white/40">
                  Available credits
                </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
             <CreditCard className="w-4 h-4 text-white/40" />
             <span className="text-xs text-white/40">
               {creditsLoading ? "..." : credits !== null ? credits : 0}
             </span>
          </div>
        )}
      </div>
    </aside>
  );
}

export function DashboardSidebar({ isCollapsed = false, setIsCollapsed }: DashboardSidebarProps) {
  return (
    <Suspense fallback={
      <aside 
        className={cn(
          "fixed left-0 top-[80px] bottom-0 border-r border-white/10 bg-black/50 backdrop-blur-xl hidden md:flex flex-col transition-all duration-300",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="p-4 flex flex-col gap-2">
          <div className="text-white/60 text-sm">Loading...</div>
        </div>
      </aside>
    }>
      <DashboardSidebarContent isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
    </Suspense>
  );
}
