import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Note: The workspace root warning is expected when there are multiple lockfiles
  // This is safe to ignore - Next.js will use the correct lockfile for the frontend
  
  // Performance optimizations
  compress: true,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  
  // Turbopack configuration (empty to silence error, webpack will be used when --webpack flag is passed)
  turbopack: {},
  
  // Webpack optimizations (used when --webpack flag is passed)
  webpack: (config, { isServer }) => {
    // Suppress punycode deprecation warning
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        punycode: false,
      },
    };
    
    // Suppress deprecation warnings in console
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /punycode/,
      /The punycode module is deprecated/,
    ];
    
    // Optimize bundle size
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for large dependencies
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;
