"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Menu, X, CreditCard, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        const userDoc = await getDoc(doc(getDb(), 'users', user.uid));
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

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out border-b border-transparent",
          isScrolled ? "bg-black/50 backdrop-blur-md border-white/10 py-3" : "bg-transparent py-5"
        )}
      >
        <div className="container mx-auto px-4 md:px-6">
          <nav className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 group-hover:from-purple-500 group-hover:to-blue-500 transition-all duration-300">
                <Sparkles className="w-6 h-6 text-white fill-white/20" />
                <div className="absolute inset-0 rounded-xl ring-1 ring-white/20 group-hover:ring-white/40 transition-all" />
              </div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                Vi3W
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {!isLoggedIn ? (
                <>
                  <NavLink href="/features">Features</NavLink>
                  <NavLink href="/gallery">Gallery</NavLink>
                  <NavLink href="/pricing">Pricing</NavLink>
                </>
              ) : (
                <>
                   <NavLink href="/dashboard">Dashboard</NavLink>
                   <NavLink href="/dashboard/text-to-3d">Text to 3D</NavLink>
                   <NavLink href="/dashboard/floorplan-3d">Floorplan</NavLink>
                </>
              )}
            </div>

            {/* Right Side Actions */}
            <div className="hidden md:flex items-center gap-4">
              {isLoggedIn ? (
                <div className="flex items-center gap-4">
                  {/* Credit Counter */}
                  <Link 
                    href="/dashboard/credits"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors group cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
                    <span className="text-sm font-medium text-white/90">
                      {creditsLoading ? "..." : credits !== null ? credits.toLocaleString() : 0}
                    </span>
                    <span className="text-xs text-white/50 uppercase tracking-wider">Credits</span>
                  </Link>

                  {/* User Profile */}
                  <div className="flex items-center gap-3 pl-2 border-l border-white/10">
                    <button 
                        onClick={() => logout()}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-white/80 hover:border-white/30 transition-all cursor-pointer"
                        title="Logout"
                    >
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="User" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <User className="w-5 h-5" />
                        )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link 
                    href="/login"
                    className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    Log In
                  </Link>
                  <Link 
                    href="/signup"
                    className="px-5 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-gray-200 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden text-white/70 hover:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 top-[70px] bg-black/95 backdrop-blur-xl z-40 md:hidden flex flex-col p-6 gap-6 border-t border-white/10"
          >
             <div className="flex flex-col gap-6 text-lg">
                {!isLoggedIn ? (
                    <>
                        <MobileLink href="/features">Features</MobileLink>
                        <MobileLink href="/gallery">Gallery</MobileLink>
                        <MobileLink href="/pricing">Pricing</MobileLink>
                    </>
                ) : (
                    <>
                        <MobileLink href="/dashboard">Dashboard</MobileLink>
                        <MobileLink href="/dashboard/text-to-3d">Text to 3D</MobileLink>
                        <MobileLink href="/dashboard/floorplan-3d">Floorplan</MobileLink>
                    </>
                )}
             </div>
             
             <div className="mt-auto border-t border-white/10 pt-6">
                {!isLoggedIn ? (
                    <div className="flex flex-col gap-4">
                        <Link href="/login" className="w-full py-3 rounded-lg bg-white/10 text-center font-medium text-white">Log In</Link>
                        <Link href="/signup" className="w-full py-3 rounded-lg bg-white text-black text-center font-bold">Get Started</Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                         <Link 
                           href="/dashboard/credits"
                           className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                         >
                            <span className="text-white/60">Credits</span>
                            <span className="text-xl font-bold text-white">
                              {creditsLoading ? "..." : credits !== null ? credits.toLocaleString() : 0}
                            </span>
                         </Link>
                         <button onClick={() => logout()} className="w-full py-3 rounded-lg bg-red-500/10 text-red-400 text-center font-medium hover:bg-red-500/20">Logout</button>
                    </div>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  return (
    <Link 
      href={href} 
      className={cn(
        "text-sm font-medium transition-colors hover:text-white relative py-1",
        isActive ? "text-white" : "text-white/60"
      )}
    >
      {children}
      {isActive && (
        <motion.div 
          layoutId="activeNav"
          className="absolute -bottom-1 left-0 right-0 h-0.5 bg-purple-500 rounded-full"
        />
      )}
    </Link>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="text-white/80 hover:text-white font-medium block">
            {children}
        </Link>
    )
}
