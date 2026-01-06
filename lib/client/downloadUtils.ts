/**
 * Download utility functions for 3D models and files
 */

/**
 * Download a file from a URL with proper filename
 * Handles CORS and shows progress
 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
    try {
        // Extract filename from URL if not provided
        if (!filename) {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            filename = pathParts[pathParts.length - 1] || 'model.glb';

            // Remove query parameters from filename
            filename = filename.split('?')[0];
        }

        // Fetch the file through our proxy to avoid CORS issues
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        // Get the blob
        const blob = await response.blob();

        // Create a temporary URL for the blob
        const blobUrl = window.URL.createObjectURL(blob);

        // Create a temporary anchor element and trigger download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Download failed:', error);
        throw error;
    }
}

/**
 * Download model in specified format
 */
export async function downloadModel(
    modelUrls: {
        glb?: string;
        fbx?: string;
        obj?: string;
        usdz?: string;
    },
    format: 'glb' | 'fbx' | 'obj' | 'usdz',
    baseName: string = 'model'
): Promise<void> {
    const url = modelUrls[format];

    if (!url) {
        throw new Error(`${format.toUpperCase()} format not available for this model`);
    }

    const filename = `${baseName}.${format}`;
    await downloadFile(url, filename);
}

/**
 * Get file size from URL
 */
export async function getFileSize(url: string): Promise<number | null> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        return contentLength ? parseInt(contentLength, 10) : null;
    } catch (error) {
        console.error('Failed to get file size:', error);
        return null;
    }
}

/**
 * Format bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
