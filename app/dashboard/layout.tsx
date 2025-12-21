"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { GenerationProvider } from "@/contexts/GenerationContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Check if we are on one of the full-width pages
  const isFullWidthPage = pathname === "/dashboard/text-to-3d/new" || pathname === "/dashboard/floorplan-3d/new";

  // Initialize state based on the current path to prevent layout shift on refresh
  const [isCollapsed, setIsCollapsed] = useState(isFullWidthPage);

  // Sync state when navigating
  useEffect(() => {
    if (isFullWidthPage) {
      setIsCollapsed(true);
    }
  }, [pathname, isFullWidthPage]);

  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <GenerationProvider>
      <div className="min-h-screen pt-[80px]">
        <DashboardSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <main
          className={cn(
            "transition-all duration-300 ease-in-out min-h-[calc(100vh-80px)]",
            isCollapsed ? "md:ml-20" : "md:ml-64",
            isFullWidthPage ? "p-0" : "p-6"
          )}
        >
          {children}
        </main>
      </div>
    </GenerationProvider>
  );
}
