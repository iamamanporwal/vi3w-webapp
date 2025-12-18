import { auth } from "./firebase";
import toast from "react-hot-toast";

// API URL Configuration:
// - If NEXT_PUBLIC_API_URL is set, use it (for Hugging Face or custom backend)
// - Otherwise, default to localhost:8000 (for local development)
// - NEVER use localhost:3000 (that's the frontend itself!)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Validate API URL (prevent common mistakes)
if (typeof window !== "undefined") {
  if (API_BASE_URL.includes("localhost:3000") || API_BASE_URL.includes("127.0.0.1:3000")) {
    console.error(
      "[Vi3W API] ❌ ERROR: API URL points to frontend (localhost:3000). " +
      "This will cause crashes! Use backend URL instead:\n" +
      "  - Local backend: http://localhost:8000\n" +
      "  - Hugging Face: https://amanporwal-vi3w-backend.hf.space"
    );
  }
  
  // Debug: Log API URL in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Vi3W API] Using API URL:", API_BASE_URL);
    console.log("[Vi3W API] Source:", process.env.NEXT_PUBLIC_API_URL ? "NEXT_PUBLIC_API_URL env var" : "default (localhost:8000)");
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[Vi3W API] No authenticated user found");
    return {};
  }
  try {
    const token = await user.getIdToken();
    if (!token) {
      console.warn("[Vi3W API] Failed to get ID token");
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    console.error("[Vi3W API] Error getting ID token:", error);
    return {};
  }
}

export interface Project {
  id: string;
  user_id: string;
  workflow_type: "text-to-3d" | "floorplan-3d";
  input_data: any;
  output_data: any;
  created_at: any;
  title?: string | null;
  generation_count?: number;
  latest_generation_id?: string | null;
  updated_at?: any;
}

export interface Generation {
  id: string;
  user_id: string;
  workflow_type: "text-to-3d" | "floorplan-3d";
  status: "pending" | "generating" | "completed" | "failed";
  progress_percentage: number;
  input_data: any;
  output_data: any | null;
  error_message: string | null;
  created_at: any;
  updated_at: any;
  project_id: string | null;
  generation_number?: number | null;
}

export async function fetchProjects(workflowType?: string): Promise<Project[]> {
  try {
    const headers = await getAuthHeader();
    const query = workflowType ? `?workflow_type=${workflowType}` : "";
    const url = `${API_BASE_URL}/api/projects${query}`;
    
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      console.log("[Vi3W API] Fetching projects from:", url);
      console.log("[Vi3W API] Has auth header:", !!headers.Authorization);
    }
    
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to fetch projects" }));
      console.error("[Vi3W API] Projects fetch failed:", error, "Status:", res.status);
      toast.error(error.detail || "Failed to fetch projects");
      throw new Error(error.detail || "Failed to fetch projects");
    }
    return res.json();
  } catch (error: any) {
    console.error("[Vi3W API] Error in fetchProjects:", error);
    if (error.message && !error.message.includes("Failed to fetch projects")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function generateTextTo3D(prompt: string, imageUrl?: string) {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/text-to-3d`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_url: imageUrl }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Generation failed" }));
      const errorMessage = error.detail || "Generation failed";
      
      // Check for insufficient credits
      if (errorMessage.toLowerCase().includes("credit") || errorMessage.toLowerCase().includes("insufficient")) {
        toast.error("Insufficient credits. Please purchase more credits to continue.", {
          duration: 5000,
        });
      } else {
        toast.error(errorMessage);
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Generation failed")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function generateFloorplan3D(file?: File, prompt?: string) {
  try {
    const headers = await getAuthHeader();
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (prompt) formData.append("prompt", prompt || "");

    // FormData content-type is automatically set by browser
    // We need to cast headers to any or specific type if spreading mixed types cause issues, 
    // but here it is just Record<string, string>.
    const res = await fetch(`${API_BASE_URL}/api/floorplan-3d`, {
      method: "POST",
      headers: { ...headers }, 
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Generation failed" }));
      const errorMessage = error.detail || "Generation failed";
      
      // Check for insufficient credits
      if (errorMessage.toLowerCase().includes("credit") || errorMessage.toLowerCase().includes("insufficient")) {
        toast.error("Insufficient credits. Please purchase more credits to continue.", {
          duration: 5000,
        });
      } else {
        toast.error(errorMessage);
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Generation failed")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function fetchGenerations(
  workflowType?: string,
  status?: string
): Promise<Generation[]> {
  try {
    const headers = await getAuthHeader();
    const params = new URLSearchParams();
    if (workflowType) params.append("workflow_type", workflowType);
    if (status) params.append("status", status);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/api/generations${query}`, { headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to fetch generations" }));
      toast.error(error.detail || "Failed to fetch generations");
      throw new Error(error.detail || "Failed to fetch generations");
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Failed to fetch generations")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function fetchGeneration(generationId: string): Promise<Generation> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/generations/${generationId}`, { headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to fetch generation" }));
      toast.error(error.detail || "Failed to fetch generation");
      throw new Error(error.detail || "Failed to fetch generation");
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Failed to fetch generation")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function fetchProject(projectId: string): Promise<Project> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, { headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to fetch project" }));
      toast.error(error.detail || "Failed to fetch project");
      throw new Error(error.detail || "Failed to fetch project");
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Failed to fetch project")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function fetchProjectGenerations(projectId: string): Promise<Generation[]> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/generations`, { headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to fetch project generations" }));
      toast.error(error.detail || "Failed to fetch project generations");
      throw new Error(error.detail || "Failed to fetch project generations");
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Failed to fetch project generations")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function createProjectGeneration(
  projectId: string,
  inputData: any
): Promise<{ generation_id: string; project_id: string; generation_number: number | null }> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/generate`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ input_data: inputData }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to create generation" }));
      const errorMessage = error.detail || "Failed to create generation";
      
      // Check for insufficient credits
      if (errorMessage.toLowerCase().includes("credit") || errorMessage.toLowerCase().includes("insufficient")) {
        toast.error("Insufficient credits. Please purchase more credits to continue.", {
          duration: 5000,
        });
      } else {
        toast.error(errorMessage);
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Failed to create generation")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

// Transaction Types
export interface Transaction {
  id: string;
  user_id: string;
  type: "purchase" | "usage";
  amount: number; // credits
  status: "pending" | "completed" | "failed";
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  project_id?: string | null;
  generation_id?: string | null;
  metadata?: Record<string, any>;
  created_at: any;
}

// Payment API Functions
export async function createPaymentOrder(): Promise<{ order_id: string; amount: number; currency: string }> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/payments/create-order`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to create payment order" }));
      toast.error(error.detail || "Failed to create payment order");
      throw new Error(error.detail || "Failed to create payment order");
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Failed to create payment order")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function verifyPayment(paymentId: string, orderId: string, signature: string): Promise<{ success: boolean; message?: string }> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/payments/verify`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ payment_id: paymentId, order_id: orderId, signature }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Payment verification failed" }));
      toast.error(error.detail || "Payment verification failed");
      throw new Error(error.detail || "Payment verification failed");
    }
    const result = await res.json();
    if (result.success) {
      toast.success("Payment successful! Credits have been added to your account.");
    }
    return result;
  } catch (error: any) {
    if (error.message && !error.message.includes("Payment verification failed")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}

export async function fetchTransactions(): Promise<Transaction[]> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/transactions`, { headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to fetch transactions" }));
      toast.error(error.detail || "Failed to fetch transactions");
      throw new Error(error.detail || "Failed to fetch transactions");
    }
    return res.json();
  } catch (error: any) {
    if (error.message && !error.message.includes("Failed to fetch transactions")) {
      toast.error(error.message || "An error occurred");
    }
    throw error;
  }
}
