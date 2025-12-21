"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchGeneration, Generation } from "@/lib/client-api";

interface UseGenerationStatusOptions {
  generationId: string | null;
  pollInterval?: number; // milliseconds, default 2000-3000
  onComplete?: (generation: Generation) => void;
  onError?: (error: Error) => void;
}

export function useGenerationStatus({
  generationId,
  pollInterval = 3000,
  onComplete,
  onError,
}: UseGenerationStatusOptions) {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const timeoutMs = 300000; // 5 minutes timeout

  const fetchStatus = useCallback(async () => {
    if (!generationId) {
      setLoading(false);
      return;
    }

    // Check timeout
    if (startTimeRef.current && Date.now() - startTimeRef.current > timeoutMs) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setLoading(false);
      const timeoutError = new Error("Generation timed out. Please try again.");
      setError(timeoutError);
      if (onError) onError(timeoutError);
      return;
    }

    try {
      // Use silent mode during polling to avoid console errors and toast spam
      const gen = await fetchGeneration(generationId);

      if (!gen) {
        // Generation not found yet, continue polling
        return;
      }

      setGeneration(gen);
      setError(null);

      // Check for status changes
      if (prevStatusRef.current !== gen.status) {
        if (gen.status === "completed" && onComplete) {
          onComplete(gen);
        } else if (gen.status === "failed" && onError) {
          onError(new Error(gen.error_message || "Generation failed"));
        }
        prevStatusRef.current = gen.status;
      }

      // Stop polling if completed or failed
      if (gen.status === "completed" || gen.status === "failed") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setLoading(false);
      }
    } catch (err) {
      // Silently handle errors during polling - don't set error state or stop polling
      // Only log to console in development mode
      if (process.env.NODE_ENV === 'development') {
        const error = err instanceof Error ? err : new Error("Failed to fetch generation status");
        // Only log if it's not a 404 (generation might not exist yet)
        if (!error.message.includes("not found") && !error.message.includes("404")) {
          console.warn(`[useGenerationStatus] Polling error (will retry):`, error.message);
        }
      }
      // Don't set error state or stop polling - just continue silently
      // The generation might not exist yet or there might be a temporary network issue
    }
  }, [generationId, onComplete, onError]);

  useEffect(() => {
    if (!generationId) {
      setGeneration(null);
      setLoading(false);
      startTimeRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Set start time for timeout check
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    // Initial fetch (not silent for first attempt to catch real errors)
    setLoading(true);
    fetchGeneration(generationId)
      .then((gen) => {
        if (!gen) {
          setError(new Error("Generation not found"));
          setLoading(false);
          return;
        }

        setGeneration(gen);
        setError(null);

        // Check for status changes
        if (prevStatusRef.current !== gen.status) {
          if (gen.status === "completed" && onComplete) {
            onComplete(gen);
          } else if (gen.status === "failed" && onError) {
            onError(new Error(gen.error_message || "Generation failed"));
          }
          prevStatusRef.current = gen.status;
        }

        // Stop polling if completed or failed
        if (gen.status === "completed" || gen.status === "failed") {
          setLoading(false);
        }
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error("Failed to fetch generation");
        setError(error);
        setLoading(false);
        // Don't call onError for initial fetch - let polling handle it
      });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [generationId, fetchStatus]);

  // Update polling based on generation status
  useEffect(() => {
    if (!generationId || !generation) return;

    if ((generation.status === "pending" || generation.status === "generating") && !intervalRef.current) {
      // Start polling
      intervalRef.current = setInterval(() => {
        fetchStatus();
      }, pollInterval);
    } else if (
      (generation.status === "completed" || generation.status === "failed") &&
      intervalRef.current
    ) {
      // Stop polling
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setLoading(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [generation?.status, generationId, pollInterval, fetchStatus]);

  const refresh = useCallback(() => {
    if (generationId) {
      // Reset timeout on manual refresh
      startTimeRef.current = Date.now();
      fetchStatus();
    }
  }, [generationId, fetchStatus]);

  return {
    generation,
    loading,
    error,
    refresh,
  };
}
