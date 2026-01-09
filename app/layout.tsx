import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LowCreditBannerWrapper } from "@/components/LowCreditBannerWrapper";
import { QueryProvider } from "@/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vi3W - Text & Floorplan to 3D",
  description: "Generate high-quality 3D models from text prompts and 2D floorplans using AI. The ultimate tool for architects and designers.",
  keywords: ["AI", "3D generation", "floorplan to 3D", "text to 3D", "architecture", "design", "Meshy", "Trellis"],
  openGraph: {
    title: "Vi3W - Text & Floorplan to 3D",
    description: "Generate high-quality 3D models from text prompts and 2D floorplans using AI.",
    type: "website",
    locale: "en_US",
    siteName: "Vi3W",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vi3W - Text & Floorplan to 3D",
    description: "Generate high-quality 3D models from text prompts and 2D floorplans using AI.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}
      >
        <ErrorBoundary>
          <QueryProvider>
            <AuthProvider>
              <ErrorBoundary>
                <Navbar />
              </ErrorBoundary>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
              <LowCreditBannerWrapper />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: "#1a1a1a",
                    color: "#fff",
                    border: "1px solid #333",
                  },
                  success: {
                    iconTheme: {
                      primary: "#10b981",
                      secondary: "#fff",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#ef4444",
                      secondary: "#fff",
                    },
                  },
                }}
              />
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
