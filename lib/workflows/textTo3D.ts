import Replicate from 'replicate';
import axios, { AxiosError } from 'axios';
import { BaseWorkflow } from './base';
import { checkCredits, deductCredits } from '@/lib/server/billing';
import { uploadBuffer, getGenerationStoragePath } from '@/lib/server/storage';
import { retryWithBackoff } from '@/lib/server/retry';
import { withTimeout, TimeoutError } from '@/lib/server/timeout';
import { validateWorkflowInput, ValidationError } from '@/lib/server/validation';
import type { WorkflowType } from '@/types/firestore';

const MESHY_API_BASE = 'https://api.meshy.ai/openapi/v1';
const REPLICATE_TIMEOUT = 480000; // 8 minutes (increased from 5 for reliability)
const MESHY_SUBMIT_TIMEOUT = 180000; // 3 minutes (increased from 2 for reliability)
const MESHY_POLL_TIMEOUT = 900000; // 15 minutes total (increased from 7 for complex models)
const IMAGE_DOWNLOAD_TIMEOUT = 60000; // 1 minute

/**
 * Text-to-3D Workflow
 * 
 * Workflow steps:
 * 1. Generate image from text prompt (if needed) - Replicate (FREE)
 * 2. Convert image to 3D model - Meshy AI (125 credits)
 */
export class TextTo3DWorkflow extends BaseWorkflow {
  readonly name = 'Text to 3D';
  readonly cost = 125; // Cost per 3D generation (125 credits). Image generation is FREE.

  private getReplicateClient(): Replicate {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error('REPLICATE_API_TOKEN environment variable is required');
    }
    return new Replicate({ auth: token });
  }

  private getMeshyApiKey(): string {
    const key = process.env.MESHY_API_KEY;
    if (!key) {
      throw new Error('MESHY_API_KEY environment variable is required');
    }
    return key;
  }

  /**
   * Generate an image using Replicate nano-banana API
   * With retry logic and timeout handling
   */
  private async generateImage(prompt: string): Promise<string> {
    if (!prompt || !prompt.trim()) {
      throw new ValidationError('Please enter a prompt.', 'prompt');
    }

    const enhancedPrompt = `${prompt}. The image/object generated should always be clean, well-lit, in 3D perspective, with clear depth and structure. Avoid text, labels, or overlays. Ensure the subject is centered and clearly visible for optimal 3D reconstruction.`;

    return retryWithBackoff(
      async () => {
        const replicate = this.getReplicateClient();
        const output = await withTimeout(
          replicate.run('google/nano-banana', {
            input: {
              prompt: enhancedPrompt,
              output_format: 'png',
            },
          }),
          REPLICATE_TIMEOUT,
          'Image generation timed out'
        );

        if (!output || typeof output !== 'string') {
          throw new Error('Failed to generate image: Replicate returned no result.');
        }

        return output as string;
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 30000,
      }
    );
  }

  /**
   * Convert image to base64 data URI
   * With retry logic and timeout handling
   */
  private async imageToBase64(imageUrl: string): Promise<string> {
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new ValidationError('Invalid image URL', 'imageUrl');
    }

    return retryWithBackoff(
      async () => {
        const response = await withTimeout(
          axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: IMAGE_DOWNLOAD_TIMEOUT,
            maxRedirects: 10,
            validateStatus: (status) => status >= 200 && status < 400,
          }),
          IMAGE_DOWNLOAD_TIMEOUT + 5000,
          'Image download timed out'
        );

        // Validate response size (max 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (response.data.byteLength > maxSize) {
          throw new Error(`Image too large: ${(response.data.byteLength / 1024 / 1024).toFixed(2)}MB (max 50MB)`);
        }

        const buffer = Buffer.from(response.data);
        const base64 = buffer.toString('base64');

        // Determine MIME type from URL or Content-Type header
        let mimeType = 'image/png';
        const contentType = response.headers['content-type'];
        if (contentType && contentType.startsWith('image/')) {
          mimeType = contentType;
        } else {
          const match = imageUrl.match(/\.(png|jpg|jpeg|webp|gif)$/i);
          if (match) {
            mimeType = `image/${match[1].toLowerCase()}`;
          }
        }

        return `data:${mimeType};base64,${base64}`;
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
      }
    );
  }

  /**
   * Convert image to 3D model using Meshy AI
   * With retry logic, timeout handling, and robust polling
   * Returns all model URLs and metadata from Meshy API
   */
  private async convertImageTo3D(imageSource: string, generationId: string): Promise<{
    glb: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
    pre_remeshed_glb?: string;
    thumbnail_url?: string;
    texture_urls?: any[];
  }> {
    const meshyKey = this.getMeshyApiKey();

    const isDataUri = imageSource.startsWith('data:image/');

    if (isDataUri) {
      // Check data URI size (base64 is ~33% larger than binary)
      const base64Data = imageSource.split(',')[1];
      if (!base64Data || base64Data.length === 0) {
        throw new ValidationError('Image data URI is missing base64 data', 'imageSource');
      }

      // Estimate binary size (base64 is 4/3 the size of binary)
      const estimatedSize = (base64Data.length * 3) / 4;
      const maxSize = 50 * 1024 * 1024; // 50MB max
      if (estimatedSize > maxSize) {
        throw new ValidationError(`Image is too large: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB (max ${maxSize / 1024 / 1024}MB)`, 'imageSource');
      }
      console.log(`[TextTo3D] Image data URI validated. Estimated size: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
    } else {
      console.log(`[TextTo3D] Using image URL: ${imageSource}`);

      // Validate URL format
      try {
        const url = new URL(imageSource);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new ValidationError('Image URL must use HTTP or HTTPS protocol', 'imageSource');
        }
      } catch (e) {
        if (e instanceof ValidationError) throw e;
        throw new ValidationError('Invalid image URL format', 'imageSource');
      }
    }

    // Submit task to Meshy with retry
    const taskId = await retryWithBackoff(
      async () => {
        console.log('[TextTo3D] Submitting image to Meshy API...');
        const submitResponse = await withTimeout(
          axios.post(
            `${MESHY_API_BASE}/image-to-3d`,
            {
              image_url: imageSource,
              enable_pbr: true,
              should_remesh: true,
              should_texture: true,
            },
            {
              headers: {
                Authorization: `Bearer ${meshyKey}`,
                'Content-Type': 'application/json',
              },
              timeout: MESHY_SUBMIT_TIMEOUT,
              validateStatus: (status) => status >= 200 && status < 500,
            }
          ),
          MESHY_SUBMIT_TIMEOUT + 5000,
          'Meshy task submission timed out'
        );

        console.log('[TextTo3D] Meshy API response status:', submitResponse.status);
        console.log('[TextTo3D] Meshy API response data:', JSON.stringify(submitResponse.data, null, 2));

        // Handle various Meshy API response formats for task ID
        let taskId: string | undefined;

        if (typeof submitResponse.data?.result === 'string') {
          // Format 1: { "result": "task-id" }
          taskId = submitResponse.data.result;
          console.log('[TextTo3D] Extracted task ID from data.result (string):', taskId);
        } else if (submitResponse.data?.result?.id && typeof submitResponse.data.result.id === 'string') {
          // Format 2: { "result": { "id": "task-id" } }
          taskId = submitResponse.data.result.id;
          console.log('[TextTo3D] Extracted task ID from data.result.id:', taskId);
        } else if (submitResponse.data?.id && typeof submitResponse.data.id === 'string') {
          // Format 3: { "id": "task-id" }
          taskId = submitResponse.data.id;
          console.log('[TextTo3D] Extracted task ID from data.id:', taskId);
        }

        if (!taskId || taskId.trim().length === 0) {
          console.error('[TextTo3D] Failed to extract task ID. Full response:', JSON.stringify(submitResponse.data, null, 2));
          throw new Error(`Failed to get task ID from Meshy API. Response: ${JSON.stringify(submitResponse.data)}`);
        }

        console.log('[TextTo3D] Successfully got Meshy task ID:', taskId);

        // CRITICAL: Store the Meshy task ID in Firestore immediately
        // This allows the polling to be resumed if the serverless function times out
        if (generationId) {
          try {
            const { updateGeneration: updateGen } = await import('@/lib/server/firestore');
            await updateGen(generationId, {
              'output_data.meshy_task_id': taskId,
              'status': 'generating'
            } as any);
            console.log(`[TextTo3D] Stored Meshy task ID ${taskId} in generation ${generationId}`);
          } catch (dbError) {
            console.error('[TextTo3D] Failed to store Meshy task ID in Firestore:', dbError);
            // Continue anyway, as the background process still has the taskId in memory
          }
        }

        return taskId;
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 10000,
      }
    );

    // Poll for status with timeout
    const startTime = Date.now();
    const maxAttempts = 180; // 15 minutes max (900 seconds / 5 seconds per attempt)
    const pollInterval = 5000; // 5 seconds
    let lastStatus: string | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check overall timeout
      if (Date.now() - startTime > MESHY_POLL_TIMEOUT) {
        throw new TimeoutError(
          `Generation timeout: Maximum time (${MESHY_POLL_TIMEOUT / 1000 / 60} minutes) exceeded. Task may still be processing.`
        );
      }

      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      try {
        const statusResponse = await retryWithBackoff(
          async () => {
            return await axios.get(`${MESHY_API_BASE}/image-to-3d/${taskId}`, {
              headers: {
                Authorization: `Bearer ${meshyKey}`,
              },
              timeout: 30000,
              validateStatus: (status) => status >= 200 && status < 500,
            });
          },
          {
            maxRetries: 2,
            initialDelay: 1000,
            maxDelay: 5000,
          }
        );

        const status = statusResponse.data?.status;
        const progress = statusResponse.data?.progress || 0;
        lastStatus = status;

        // Log status updates (only every 10th attempt to avoid spam)
        if (attempt % 10 === 0) {
          console.log(`[TextTo3D] Polling status: ${status}, progress: ${progress}%`);
        }

        // Update generation progress based on Meshy progress (0-100)
        // Map Meshy progress to our 75-100% range (since we're already at 75% when Meshy starts)
        const mappedProgress = 75 + Math.floor((progress / 100) * 25);
        if (generationId) {
          await this.updateGenerationStatus(generationId, 'generating', {
            progressPercentage: mappedProgress,
          });
        }

        // According to Meshy API docs, status values are: PENDING, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED
        if (status === 'SUCCEEDED') {
          const modelUrls = statusResponse.data?.model_urls;
          const thumbnailUrl = statusResponse.data?.thumbnail_url;
          const textureUrls = statusResponse.data?.texture_urls;

          // Validate that we have at least the GLB URL
          if (!modelUrls?.glb || typeof modelUrls.glb !== 'string') {
            console.error('[TextTo3D] Model URLs in response:', JSON.stringify(modelUrls, null, 2));
            throw new Error('GLB URL not found in Meshy response. Check model_urls.glb in the response.');
          }

          console.log('[TextTo3D] Generation succeeded!');
          console.log('[TextTo3D] GLB URL:', modelUrls.glb);
          console.log('[TextTo3D] Available formats:', Object.keys(modelUrls).join(', '));

          // Return comprehensive model data
          return {
            glb: modelUrls.glb,
            fbx: modelUrls.fbx,
            obj: modelUrls.obj,
            usdz: modelUrls.usdz,
            pre_remeshed_glb: modelUrls.pre_remeshed_glb,
            thumbnail_url: thumbnailUrl,
            texture_urls: textureUrls,
          };
        } else if (status === 'FAILED' || status === 'CANCELED') {
          // Handle task_error object structure from Meshy API
          const taskError = statusResponse.data?.task_error;
          const errorMsg = taskError?.message || taskError || 'Unknown error';
          console.error('[TextTo3D] Task failed or canceled:', errorMsg);
          throw new Error(`Meshy Task ${status.toLowerCase()}: ${errorMsg}`);
        }

        // Status is still processing, continue polling silently
      } catch (error: any) {
        // If it's a non-retryable error, throw immediately
        if (error.response?.status === 404) {
          throw new Error(`Meshy task ${taskId} not found`);
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('Meshy API authentication failed');
        }

        // Network error during polling - retry if not last attempt
        // Don't log errors during polling to avoid console spam
        if (attempt < maxAttempts - 1) {
          continue;
        }
        // Only throw error on final attempt
        throw error;
      }
    }

    // Timeout reached
    throw new TimeoutError(
      `Generation timeout: Maximum attempts (${maxAttempts}) reached. Last status: ${lastStatus || 'unknown'}. Task may still be processing.`
    );
  }

  /**
   * Run the Text-to-3D workflow (Wrapper for execute to satisfy BaseWorkflow)
   */
  async run(userId: string, input: any): Promise<any> {
    const { generationId, projectId } = await this.execute(userId, input);
    return { generationId, result: { projectId } }; // BaseWorkflow expects this format
  }

  /**
   * Execute the Text-to-3D workflow
   */
  async execute(
    userId: string,
    input: {
      prompt?: string;
      imagePath?: string;
      projectId?: string;
      generationId?: string;
      has_image?: boolean;
    }
  ): Promise<{ generationId: string; projectId: string }> {
    const { prompt, imagePath, projectId: inputProjectId, generationId: existingGenerationId } = input;

    // Validate input
    try {
      validateWorkflowInput({ prompt, imagePath });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid input: ${error.message}`);
    }

    // DEV_MODE: Skip credit checks for local testing
    const devMode = process.env.DEV_MODE === 'true';

    // Check credits (unless in dev mode)
    if (!devMode) {
      const hasCredits = await checkCredits(userId, this.cost);
      if (!hasCredits) {
        throw new Error('Insufficient credits.');
      }
    }

    // Ensure project exists
    const projectId = await this.getOrCreateProject(
      userId,
      'text-to-3d',
      inputProjectId,
      prompt ? `3D Model: ${prompt.slice(0, 30)}...` : 'Image to 3D Model'
    );

    // Create generation event if not provided
    let generationId = existingGenerationId;
    if (!generationId) {
      generationId = await this.createGenerationEvent(
        userId,
        'text-to-3d',
        {
          prompt,
          has_image: !!imagePath,
        },
        projectId
      );
    }

    // Store generationId for progress updates
    // this.currentGenerationId = generationId; // REMOVED: Avoid state pollution

    // Update status to "generating"
    await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 0 });

    let generatedImageUrl: string | undefined;
    let imageDataUri: string;

    try {
      // Step 1: Generate image from text (if needed)
      if (!imagePath && prompt) {
        await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 25 });
        generatedImageUrl = await this.generateImage(prompt);
        await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 50 });
      }

      // Step 2: Prepare image for Meshy
      // Step 2: Prepare image for Meshy
      let imageSource: string;
      if (imagePath) {
        // If image path is provided:
        // 1. If it's a Data URI, use it directly.
        // 2. If it's a URL, convert to base64 (or use directly if Meshy supports it, but keeping existing logic for URLs).
        if (imagePath.startsWith('data:')) {
          imageSource = imagePath;
        } else {
          imageSource = await this.imageToBase64(imagePath);
        }
      } else if (generatedImageUrl) {
        // Use the generated image URL directly - Meshy prefers URLs
        imageSource = generatedImageUrl;
      } else {
        throw new Error('No prompt or image provided.');
      }

      // Step 3: Convert image to 3D (Meshy)
      await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 75 });
      const meshyResult = await this.convertImageTo3D(imageSource, generationId);

      // Build comprehensive output_data with all model formats
      const result: any = {
        model_url: meshyResult.glb,  // Primary URL for backward compatibility
        model_urls: {
          glb: meshyResult.glb,
          fbx: meshyResult.fbx,
          obj: meshyResult.obj,
          usdz: meshyResult.usdz,
          pre_remeshed_glb: meshyResult.pre_remeshed_glb,
        },
        thumbnail_url: meshyResult.thumbnail_url,
        texture_urls: meshyResult.texture_urls,
      };

      // Add generated image URL if available
      if (generatedImageUrl) {
        result.image_url = generatedImageUrl;
      }

      // Log the exact data being saved for debugging
      console.log('[TextTo3D] Saving output_data to Firestore:');
      console.log('[TextTo3D]   - model_url (GLB):', result.model_url);
      console.log('[TextTo3D]   - model_urls:', JSON.stringify(result.model_urls, null, 2));
      console.log('[TextTo3D]   - thumbnail_url:', result.thumbnail_url);
      console.log('[TextTo3D]   - image_url:', result.image_url || 'N/A');

      // Step 4: Update generation status to "completed"
      // We do this BEFORE credit deduction to ensure the user sees the result.
      await this.updateGenerationStatus(generationId, 'completed', {
        progressPercentage: 100,
        outputData: result,
      });

      // Step 5: Deduct credits AFTER successful 3D generation and status update
      // Credits are only deducted after the 3D model is successfully generated and stored.
      if (!devMode) {
        try {
          await deductCredits(userId, this.cost, {
            projectId,
            generationId,
            type: 'usage',
          });
          console.log(`[TextTo3D] Successfully deducted ${this.cost} credits for generation ${generationId}`);
        } catch (creditError) {
          console.error(`[TextTo3D] Failed to deduct credits for generation ${generationId}:`, creditError);
          // We don't throw here because the generation is already completed and successful.
          // We should probably flag this for manual review or retry.
        }
      }

      return { generationId, projectId };
    } catch (error: any) {
      // CRITICAL: Credits are NOT deducted here because the exception occurred
      // before the credit deduction point (which is only after successful 3D generation).

      // Determine error message
      let errorMessage = error.message || 'Unknown error occurred';
      if (error instanceof TimeoutError) {
        errorMessage = `Timeout: ${errorMessage}`;
      } else if (error instanceof ValidationError) {
        errorMessage = `Validation error: ${errorMessage}`;
      } else if (error.response) {
        // Axios error with response
        const status = error.response.status;
        if (status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else if (status >= 500) {
          errorMessage = 'External service error. Please try again later.';
        } else if (status === 401 || status === 403) {
          errorMessage = 'Authentication failed. Please check API credentials.';
        }
      }

      // Update generation status to "failed"
      await this.updateGenerationStatus(generationId, 'failed', {
        errorMessage,
      });

      // Re-throw with better error message
      const enhancedError = new Error(errorMessage);
      (enhancedError as any).originalError = error;
      (enhancedError as any).code = error.code || error.response?.status || 'WORKFLOW_ERROR';
      throw enhancedError;
    }
  }
}

