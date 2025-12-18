"use client";

import { initializeApp, getApps, getApp as getFirebaseApp } from "firebase/app";
import { getAuth as getFirebaseAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage as getFirebaseStorage } from "firebase/storage";

// Only initialize Firebase on the client side
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getFirebaseAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getFirebaseStorage> | null = null;

function initFirebase() {
  // Skip initialization during SSR/build time
  if (typeof window === "undefined") {
    return;
  }

  // Check if config is valid before initializing
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || apiKey === "undefined" || !apiKey.trim()) {
    console.warn("Firebase API key is not set. Skipping initialization.");
    return;
  }

  if (!app) {
    try {
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      // Validate all required config values
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.warn("Firebase config is incomplete. Skipping initialization.");
        return;
      }

      app = !getApps().length ? initializeApp(firebaseConfig) : getFirebaseApp();
      auth = getFirebaseAuth(app);
      db = getFirestore(app);
      storage = getFirebaseStorage(app);
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      // Don't throw - allow app to continue without Firebase
    }
  }
}

// Initialize Firebase when module loads on client side only
// This will not run during build/SSR
if (typeof window !== "undefined") {
  // Only initialize if we have valid config
  const hasValidConfig = 
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "undefined" &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (hasValidConfig) {
    initFirebase();
  }
}

// Helper functions that ensure Firebase is initialized
export function getApp() {
  initFirebase();
  if (!app) {
    throw new Error("Firebase app is not initialized. Make sure you're running this on the client side and Firebase config is set.");
  }
  return app;
}

export function getAuth() {
  initFirebase();
  if (!auth) {
    throw new Error("Firebase auth is not initialized. Make sure you're running this on the client side and Firebase config is set.");
  }
  return auth;
}

export function getDb() {
  initFirebase();
  if (!db) {
    throw new Error("Firebase db is not initialized. Make sure you're running this on the client side and Firebase config is set.");
  }
  return db;
}

export function getStorage() {
  initFirebase();
  if (!storage) {
    throw new Error("Firebase storage is not initialized. Make sure you're running this on the client side and Firebase config is set.");
  }
  return storage;
}

// For backward compatibility, export the instances
// These will be null during SSR but initialized on client
// Components should use the getter functions above or check for null
export { app, auth, db, storage };

