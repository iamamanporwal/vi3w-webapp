import { useQuery } from '@tanstack/react-query';
import { fetchGeneration, Generation } from '@/lib/client-api';

/**
 * Query hook for fetching a single generation by ID
 * Does NOT poll - fetches once
 */
export function useGenerationQuery(generationId: string | null) {
    return useQuery({
        queryKey: ['generation', generationId],
        queryFn: async () => {
            if (!generationId) {
                throw new Error('Generation ID is required');
            }
            const generation = await fetchGeneration(generationId);
            if (!generation) {
                throw new Error('Generation not found or returned undefined');
            }
            return generation;
        },
        enabled: !!generationId, // Only run query if generationId exists
        retry: 3, // Retry failed requests 3 times
        staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
        gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes (formerly cacheTime)
    });
}
