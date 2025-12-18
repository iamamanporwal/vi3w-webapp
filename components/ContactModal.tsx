"use client";

import { X, Mail, Phone, Linkedin, MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* Decorative gradient orb */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors duration-200 p-1 rounded-lg hover:bg-white/10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600/30 to-violet-600/30 rounded-2xl flex items-center justify-center mx-auto mb-5 backdrop-blur-sm border border-purple-500/20 shadow-lg shadow-purple-500/10">
            <MessageCircle className="w-10 h-10 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
            Need More Credits?
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
            You've used all your free generations. Contact me to get more credits or discuss enterprise plans.
          </p>
        </div>
        
        {/* Contact Options */}
        <div className="space-y-3 relative">
          <a 
            href="mailto:contact@vi3w.in"
            className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all duration-200 group"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium group-hover:text-blue-400 transition-colors">Email</p>
              <p className="text-white/40 text-sm">contact@vi3w.in</p>
            </div>
            <div className="text-white/20 group-hover:text-white/40 transition-colors">
              →
            </div>
          </a>
          
          <a 
            href="tel:+919876543210"
            className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all duration-200 group"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:border-emerald-500/40 transition-colors">
              <Phone className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium group-hover:text-emerald-400 transition-colors">Phone</p>
              <p className="text-white/40 text-sm">+91 98765 43210</p>
            </div>
            <div className="text-white/20 group-hover:text-white/40 transition-colors">
              →
            </div>
          </a>
          
          <a 
            href="https://linkedin.com/in/vi3w"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-sky-500/30 transition-all duration-200 group"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-sky-600/20 to-sky-500/10 rounded-xl flex items-center justify-center border border-sky-500/20 group-hover:border-sky-500/40 transition-colors">
              <Linkedin className="w-5 h-5 text-sky-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium group-hover:text-sky-400 transition-colors">LinkedIn</p>
              <p className="text-white/40 text-sm">Connect with me</p>
            </div>
            <div className="text-white/20 group-hover:text-white/40 transition-colors">
              →
            </div>
          </a>
        </div>
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-white/30 text-xs">
            Enterprise plans available for teams and businesses
          </p>
        </div>
      </div>
    </div>
  );
}

