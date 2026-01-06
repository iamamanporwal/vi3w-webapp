"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

/**
 * Provider component for TanStack Query
 * Wraps the app to enable React Query hooks
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  // Create a client instance per component instance
  // This ensures each user gets their own client in SSR scenarios
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus
            refetchOnWindowFocus: false,
            // Disable automatic refetching on reconnect
            refetchOnReconnect: false,
            // Retry failed requests once by default
            retry: 1,
            // Consider data stale after 5 minutes
            staleTime: 1000 * 60 * 5,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
