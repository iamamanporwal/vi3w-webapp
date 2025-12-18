"use client";

import { AlertTriangle, CreditCard, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface LowCreditBannerProps {
  credits: number;
  onContactClick: () => void;
}

export function LowCreditBanner({ credits, onContactClick }: LowCreditBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Only show if credits < 125 (not enough for one generation) and not dismissed
  if (credits >= 125 || isDismissed) return null;
  
  const isZero = credits === 0;
  const isVeryLow = credits > 0 && credits < 50;

  return (
    <div 
      className={`
        fixed bottom-0 left-0 right-0 z-40
        ${isZero 
          ? 'bg-gradient-to-r from-red-950/95 via-red-900/95 to-red-950/95' 
          : 'bg-gradient-to-r from-amber-950/95 via-amber-900/95 to-amber-950/95'
        } 
        backdrop-blur-md border-t 
        ${isZero ? 'border-red-500/30' : 'border-amber-500/30'}
        py-3.5 px-4
        animate-in slide-in-from-bottom duration-300
      `}
    >
      {/* Animated gradient overlay */}
      <div 
        className={`
          absolute inset-0 opacity-30
          ${isZero 
            ? 'bg-gradient-to-r from-transparent via-red-500/10 to-transparent' 
            : 'bg-gradient-to-r from-transparent via-amber-500/10 to-transparent'
          }
        `}
        style={{
          animation: 'shimmer 2s linear infinite',
        }}
      />
      
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 relative">
        <div className="flex items-center gap-4">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            ${isZero 
              ? 'bg-red-500/20 border border-red-500/30' 
              : 'bg-amber-500/20 border border-amber-500/30'
            }
          `}>
            <AlertTriangle className={`w-5 h-5 ${isZero ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              {isZero 
                ? "You're out of credits!" 
                : `Low credits: ${credits} remaining`
              }
              {!isZero && isVeryLow && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full font-medium">
                  Critical
                </span>
              )}
            </p>
            <p className="text-white/50 text-xs mt-0.5">
              {isZero 
                ? "Contact us to get more credits and continue creating 3D models" 
                : `Each 3D generation costs 125 credits • ${Math.floor(credits / 125)} generation${Math.floor(credits / 125) !== 1 ? 's' : ''} left`
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/credits"
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${isZero 
                ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20' 
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/30 hover:border-amber-500/40'
              }
            `}
          >
            <CreditCard className="w-4 h-4" />
            Buy Credits
          </Link>
          
          {isZero && (
            <button
              onClick={onContactClick}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 rounded-xl text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
            >
              <Sparkles className="w-4 h-4" />
              Contact Me
            </button>
          )}
          
          {!isZero && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-2 text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/5"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

