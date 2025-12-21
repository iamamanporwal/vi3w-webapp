import { ProjectWithId, GenerationWithId, TransactionWithId, WorkflowType } from "@/types/firestore";
import { getAuth } from "@/lib/firebase";

// Re-export types for compatibility
export type Project = ProjectWithId;
export type Generation = GenerationWithId;
export type Transaction = TransactionWithId;

/**
 * Helper to get auth headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        // Return empty headers if not logged in - API will return 401
        return {};
    }

    try {
        const token = await user.getIdToken();
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        };
    } catch (error) {
        console.error("Error getting auth token:", error);
        return {};
    }
}

/**
 * Fetch all projects for the current user, optionally filtered by workflow type
 */
export async function fetchProjects(workflowType?: WorkflowType): Promise<Project[]> {
    let url = "/api/projects";
    if (workflowType) {
        url += `?workflow_type=${workflowType}`;
    }


    const headers = await getAuthHeaders();
    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error("Failed to fetch projects");
    }
    const data = await response.json();

    // DEFENSIVE: Ensure we always return an array
    if (!Array.isArray(data.projects)) {
        console.warn('[client-api] fetchProjects: API returned non-array data.projects:', data);
        return [];
    }
    return data.projects;
}

/**
 * Fetch a single project by ID
 */
export async function fetchProject(projectId: string): Promise<Project> {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/projects/${projectId}`, { headers });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Project not found");
        }
        throw new Error("Failed to fetch project");
    }
    const data = await response.json();
    return data.project;
}

/**
 * Fetch a single generation by ID
 */
export async function fetchGeneration(generationId: string): Promise<Generation> {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/generations/${generationId}`, { headers });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Generation not found");
        }
        throw new Error("Failed to fetch generation");
    }
    const data = await response.json();
    return data.generation;
}

/**
 * Fetch generations for a specific project
 */
export async function fetchProjectGenerations(projectId: string): Promise<Generation[]> {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/projects/${projectId}/generations`, { headers });

    if (!response.ok) {
        throw new Error("Failed to fetch project generations");
    }
    const data = await response.json();

    // DEFENSIVE: Ensure we always return an array
    if (!Array.isArray(data.generations)) {
        console.warn('[client-api] fetchProjectGenerations: API returned non-array data.generations:', data);
        return [];
    }

    console.log('[client-api] fetchProjectGenerations:', {
        projectId,
        count: data.generations.length,
        statuses: data.generations.map((g: Generation) => ({ id: g.id, status: g.status }))
    });

    return data.generations;
}

/**
 * Fetch transactions for the current user
 */
export async function fetchTransactions(): Promise<Transaction[]> {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/transactions", { headers });

    if (!response.ok) {
        throw new Error("Failed to fetch transactions");
    }
    const data = await response.json();

    // DEFENSIVE: Ensure we always return an array
    if (!Array.isArray(data.transactions)) {
        console.warn('[client-api] fetchTransactions: API returned non-array data.transactions:', data);
        return [];
    }
    return data.transactions;
}

/**
 * Create a payment order
 */
export async function createPaymentOrder(amount: number, credits: number) {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
            ...headers,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount, credits }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create payment order");
    }

    return response.json();
}

/**
 * Verify a payment
 */
export async function verifyPayment(paymentId: string, orderId: string, signature: string) {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
            ...headers,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            payment_id: paymentId,
            order_id: orderId,
            signature: signature,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Payment verification failed");
    }

    return response.json();
}
