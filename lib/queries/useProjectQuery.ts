import { useQuery } from '@tanstack/react-query';
import { fetchProject } from '@/lib/client-api';

/**
 * Query hook for fetching a single project by ID
 */
export function useProjectQuery(projectId: string | null) {
    return useQuery({
        queryKey: ['project', projectId],
        queryFn: async () => {
            if (!projectId) {
                throw new Error('Project ID is required');
            }
            const project = await fetchProject(projectId);
            if (!project) {
                throw new Error('Project not found or returned undefined');
            }
            return project;
        },
        enabled: !!projectId,
        retry: 2,
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
    });
}
