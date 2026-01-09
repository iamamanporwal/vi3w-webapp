import { useQuery } from '@tanstack/react-query';
import { fetchProjectGenerations } from '@/lib/client-api';

/**
 * Query hook for fetching all generations for a specific project
 */
export function useProjectGenerationsQuery(projectId: string | null) {
    return useQuery({
        queryKey: ['projectGenerations', projectId],
        queryFn: async () => {
            if (!projectId) {
                throw new Error('Project ID is required');
            }
            const generations = await fetchProjectGenerations(projectId);
            // Ensure we always return an array
            return Array.isArray(generations) ? generations : [];
        },
        enabled: !!projectId,
        retry: 2,
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
    });
}
