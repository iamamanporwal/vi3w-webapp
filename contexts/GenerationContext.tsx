"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { fetchGeneration, Generation } from "@/lib/api";
import { getDb } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

interface GenerationContextType {
  activeGenerations: Generation[];
  loading: boolean;
  refreshGenerations: () => Promise<void>;
  getGeneration: (generationId: string) => Promise<Generation | null>;
}

const GenerationContext = createContext<GenerationContextType>({
  activeGenerations: [],
  loading: false,
  refreshGenerations: async () => {},
  getGeneration: async () => null,
});

export const useGeneration = () => useContext(GenerationContext);

export const GenerationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [activeGenerations, setActiveGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  // Convert Firestore document to Generation type
  const docToGeneration = (doc: DocumentData): Generation => {
    const data = doc.data();
    return {
      id: doc.id,
      user_id: data.user_id || "",
      workflow_type: data.workflow_type || "text-to-3d",
      status: data.status || "pending",
      progress_percentage: data.progress_percentage || 0,
      input_data: data.input_data || {},
      output_data: data.output_data || null,
      error_message: data.error_message || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      project_id: data.project_id || null,
    };
  };

  // Real-time Firestore listener for active generations
  useEffect(() => {
    if (authLoading || !user) {
      setActiveGenerations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Create query for active generations (pending or generating) for this user
    // Note: We filter by user_id and status, then sort by created_at in JavaScript
    // to avoid requiring a Firestore composite index
    const generationsRef = collection(getDb(), "generations");
    const q = query(
      generationsRef,
      where("user_id", "==", user.uid),
      where("status", "in", ["pending", "generating"])
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const generations: Generation[] = [];
        
        snapshot.forEach((doc) => {
          try {
            const generation = docToGeneration(doc);
            generations.push(generation);
          } catch (error) {
            console.error(`Error processing generation ${doc.id}:`, error);
          }
        });

        // Sort by created_at descending (newest first)
        generations.sort((a, b) => {
          const aTime = a.created_at?.toMillis?.() || 0;
          const bTime = b.created_at?.toMillis?.() || 0;
          return bTime - aTime; // Descending order
        });

        setActiveGenerations(generations);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to generations:", error);
        setLoading(false);
        setActiveGenerations([]);
      }
    );

    // Cleanup listener on unmount or when user changes
    return () => {
      unsubscribe();
    };
  }, [user, authLoading]);

  // Manual refresh function (for fallback or manual triggers)
  const refreshGenerations = useCallback(async () => {
    if (authLoading || !user) {
      setActiveGenerations([]);
      return;
    }

    // The real-time listener will automatically update the state
    // This function is kept for API compatibility but the listener handles updates
    try {
      setLoading(true);
      // The onSnapshot listener will update activeGenerations automatically
      // We just need to wait for it
    } catch (error) {
      console.error("Error refreshing generations:", error);
      setActiveGenerations([]);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  const getGeneration = useCallback(async (generationId: string): Promise<Generation | null> => {
    if (!user) return null;
    
    try {
      const generation = await fetchGeneration(generationId);
      return generation;
    } catch (error) {
      console.error("Error fetching generation:", error);
      return null;
    }
  }, [user]);

  return (
    <GenerationContext.Provider
      value={{
        activeGenerations,
        loading,
        refreshGenerations,
        getGeneration,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
};

