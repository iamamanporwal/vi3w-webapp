"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { getAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: (User & { credits?: number }) | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => { },
  signUpWithEmail: async () => { },
  signInWithEmail: async () => { },
  logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<(User & { credits?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        const unsubscribeAuth = onAuthStateChanged(getAuth(), async (user) => {
          if (user) {
            try {
              const token = await user.getIdToken();
              document.cookie = `token=${token}; path=/; max-age=3600; SameSite=Strict`;

              // Listen for user document changes (credits)
              // Move imports to top or use standard import if possible, but keeping dynamic for now if needed for SSR safety
              // However, we are in useEffect so we are on client.
              const { doc, onSnapshot } = await import("firebase/firestore");
              const { getDb } = await import("@/lib/firebase");
              const userRef = doc(getDb(), "users", user.uid);

              unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
                if (doc.exists()) {
                  const userData = doc.data();
                  // Update user object with latest data while preserving auth properties
                  setUser(prev => {
                    // Only update if data actually changed to prevent loops
                    if (prev && prev.credits === userData.credits) return prev;
                    return { ...user, ...userData };
                  });
                } else {
                  setUser(user);
                }
              }, (error) => {
                console.error("Error listening to user data:", error);
                // Fallback to just auth user if firestore fails
                setUser(user);
              });
            } catch (error) {
              console.error("Error setting up user session:", error);
              setUser(user);
            }
          } else {
            document.cookie = `token=; path=/; max-age=0;`;
            setUser(null);
            if (unsubscribeSnapshot) {
              unsubscribeSnapshot();
              unsubscribeSnapshot = undefined;
            }
          }
          setLoading(false);
        });
        return unsubscribeAuth;
      } catch (error) {
        console.error("Auth initialization error:", error);
        setLoading(false);
        return () => { };
      }
    };

    const authUnsubPromise = initializeAuth();

    return () => {
      authUnsubPromise.then(unsub => unsub && unsub());
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(getAuth(), provider);
      const token = await result.user.getIdToken();
      document.cookie = `token=${token}; path=/; max-age=3600; SameSite=Strict`;
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(getAuth(), email, password);
      await updateProfile(result.user, {
        displayName: name
      });
      const token = await result.user.getIdToken();
      document.cookie = `token=${token}; path=/; max-age=3600; SameSite=Strict`;
      // Force reload to update user state with display name
      setUser({ ...result.user, displayName: name });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Error signing up", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(getAuth(), email, password);
      const token = await result.user.getIdToken();
      document.cookie = `token=${token}; path=/; max-age=3600; SameSite=Strict`;
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Error signing in", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(getAuth());
      document.cookie = `token=; path=/; max-age=0;`;
      router.push("/");
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signUpWithEmail, signInWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
