import Replicate from 'replicate';
import axios, { AxiosError } from 'axios';
import { BaseWorkflow } from './base';
import { checkCredits, deductCredits } from '@/lib/server/billing';
import { uploadBuffer, getGenerationStoragePath } from '@/lib/server/storage';
import { retryWithBackoff } from '@/lib/server/retry';
import { withTimeout, TimeoutError } from '@/lib/server/timeout';
import { validateWorkflowInput, ValidationError } from '@/lib/server/validation';
import type { WorkflowType } from '@/types/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TRELLIS_VERSION = '4876f2a8da1c544772dffa32e8889da4a1bab3a1f5c1937bfcfccb99ae347251';
const REPLICATE_TIMEOUT = 300000; // 5 minutes
const FILE_DOWNLOAD_TIMEOUT = 300000; // 5 minutes for large files
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Floorplan-to-3D Workflow
 * 
 * Workflow steps:
 * 1. Generate floorplan from prompt (if needed) - Replicate (FREE)
 * 2. Convert floorplan to isometric view - Replicate (FREE)
 * 3. Convert isometric to 3D model - TRELLIS via Replicate (125 credits)
 */
export class FloorplanTo3DWorkflow extends BaseWorkflow {
  readonly name = 'Floorplan to 3D';
  readonly cost = 125; // Cost per 3D generation (125 credits). Image generation steps are FREE.

  private getReplicateClient(): Replicate {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error('REPLICATE_API_TOKEN environment variable is required');
    }
    return new Replicate({ auth: token });
  }

  /**
   * Download URL to temporary file with retry logic and validation
   */
  private async downloadToTemp(url: string, suffix: string): Promise<string> {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('Invalid URL', 'url');
    }

    return retryWithBackoff(
      async () => {
        const response = await withTimeout(
          axios.get(url, {
            responseType: 'arraybuffer',
            timeout: FILE_DOWNLOAD_TIMEOUT,
            maxRedirects: 10,
            validateStatus: (status) => status >= 200 && status < 400,
          }),
          FILE_DOWNLOAD_TIMEOUT + 10000,
          'File download timed out'
        );

        // Validate file size
        if (response.data.byteLength > MAX_FILE_SIZE) {
          throw new Error(
            `File too large: ${(response.data.byteLength / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
          );
        }

        // Create temp file with unique name
        const tempFile = path.join(
          os.tmpdir(),
          `vi3w-${Date.now()}-${Math.random().toString(36).substring(7)}${suffix}`
        );

        // Write file atomically
        fs.writeFileSync(tempFile, Buffer.from(response.data));

        // Verify file was written
        if (!fs.existsSync(tempFile)) {
          throw new Error('Failed to write temp file');
        }

        return tempFile;
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 10000,
      }
    );
  }

  /**
   * Generate a floorplan using Replicate nano-banana API
   * With retry logic and timeout handling
   */
  private async generateFloorplan(prompt: string): Promise<string> {
    if (!prompt || !prompt.trim()) {
      throw new ValidationError('Prompt is required', 'prompt');
    }

    return retryWithBackoff(
      async () => {
        const replicate = this.getReplicateClient();
        const output = await withTimeout(
          replicate.run('google/nano-banana', {
            input: {
              prompt: prompt.trim(),
              output_format: 'png',
            },
          }),
          REPLICATE_TIMEOUT,
          'Floorplan generation timed out'
        );

        if (!output || typeof output !== 'string') {
          throw new Error('Failed to generate floorplan: Replicate returned no result.');
        }

        // Download to temp file
        return await this.downloadToTemp(output as string, '.png');
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 30000,
      }
    );
  }

  /**
   * Convert 2D floorplan to isometric view using Replicate
   * With retry logic, timeout handling, and file validation
   */
  private async convertToIsometric(imagePath: string): Promise<string> {
    // Validate file exists
    if (!fs.existsSync(imagePath)) {
      throw new ValidationError(`Image file not found: ${imagePath}`, 'imagePath');
    }

    // Validate file size
    const stats = fs.statSync(imagePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`Image file too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    const editPrompt = `Create a high-end, 3D isometric visualization of this 2D floor plan, styled as a photorealistic Blender (Cycles) 3D render.
View: Low-angle isometric.
Style & Lighting: Achieve a bright, airy, and clean atmosphere using a global illumination setup (like an HDRI) for soft, diffuse, and physically accurate lighting. Shadows must be subtle and soft-edged.
Materials & Furniture: Use high-quality, PBR materials.
Floors: Light-colored with realistic textures (e.g., light wood, matte white tiles).
Furniture & Kitchen: All furniture, including kitchen cabinetry and islands, must be a little dark in color (e.g., charcoal gray, dark walnut wood, muted earth tones) to create a gentle contrast. Models should be simple, modern, and have clean geometry.
Instructions:
PRIMARY DIRECTIVE: GEOMETRIC ACCURACY IS NON-NEGOTIABLE. The final 3D model must be an exact replica of the 2D floor plan's layout, wall placement, and proportions. Do not alter the scale, shape, or dimensions of any room or structural element. Any deviation from the source layout is a failure.
CLEAN VISUALIZATION ONLY: The final 3D image must be a clean architectural rendering. Absolutely no text, labels, dimensions, or measurement lines from the original 2D plan are to be included.
Ensure the entire structure is visible with a margin around it.`;

    return retryWithBackoff(
      async () => {
        const replicate = this.getReplicateClient();

        const output = await withTimeout(
          replicate.run('google/nano-banana', {
            input: {
              prompt: editPrompt,
              image_input: imagePath, // File path as string
              output_format: 'png',
            },
          }),
          REPLICATE_TIMEOUT,
          'Isometric conversion timed out'
        );

        if (!output || typeof output !== 'string') {
          throw new Error('Failed to convert to isometric: Replicate returned no result.');
        }

        // Download to temp file
        return await this.downloadToTemp(output as string, '.png');
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 30000,
      }
    );
  }

  /**
   * Convert isometric image to 3D GLB model using TRELLIS
   * With retry logic, timeout handling, and file validation
   */
  private async generate3DModel(isometricPath: string): Promise<{ glbPath: string; videoPath?: string }> {
    // Validate file exists
    if (!fs.existsSync(isometricPath)) {
      throw new ValidationError(`Isometric image file not found: ${isometricPath}`, 'isometricPath');
    }

    return retryWithBackoff(
      async () => {
        const replicate = this.getReplicateClient();

        const output = await withTimeout(
          replicate.run(`firtoz/trellis:${TRELLIS_VERSION}`, {
            input: {
              images: [isometricPath], // File path as string
              seed: 0,
              randomize_seed: true,
              generate_color: true,
              generate_normal: true,
              generate_model: true,
              ss_guidance_strength: 7.5,
              ss_sampling_steps: 12,
              slat_guidance_strength: 3.0,
              slat_sampling_steps: 12,
              mesh_simplify: 0.95,
              texture_size: 2048,
            },
          }).then((output) => {
            // Validate output structure immediately
            if (!output || typeof output !== 'object') {
              throw new Error(`Unexpected output format from Trellis: ${typeof output}`);
            }
            return output;
          }).catch((error) => {
            console.error('[Floorplan3D] Replicate Trellis Error:', error);
            throw error;
          }),
          REPLICATE_TIMEOUT * 2, // TRELLIS takes longer, allow 10 minutes
          '3D model generation timed out'
        );

        if (!output || typeof output !== 'object') {
          throw new Error(`Unexpected output format from Trellis: ${typeof output}`);
        }

        const modelUrl = (output as any).model_file;
        const videoUrl = (output as any).combined_video;

        if (!modelUrl || typeof modelUrl !== 'string') {
          throw new Error('Failed to generate 3D model: No model file in Trellis output.');
        }

        const glbPath = await this.downloadToTemp(modelUrl, '.glb');
        const videoPath = videoUrl && typeof videoUrl === 'string'
          ? await this.downloadToTemp(videoUrl, '.mp4')
          : undefined;

        return { glbPath, videoPath };
      },
      {
        maxRetries: 2, // TRELLIS is expensive, fewer retries
        initialDelay: 5000,
        maxDelay: 30000,
      }
    );
  }

  /**
   * Safely cleanup temp files
   */
  private cleanupTempFiles(files: string[]): void {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error: any) {
        console.error(`Failed to cleanup temp file ${file}:`, error);
        // Continue with other files
      }
    }
  }

  /**
   * Run the Floorplan-to-3D workflow
   */
  async run(
    userId: string,
    input: {
      prompt?: string;
      imagePath?: string;
      projectId?: string;
      generationId?: string;
    }
  ): Promise<{
    generationId: string;
    result: any;
  }> {
    const { prompt, imagePath, projectId, generationId: existingGenerationId } = input;

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

    // Create generation event if not provided
    let generationId = existingGenerationId;
    if (!generationId) {
      generationId = await this.createGenerationEvent(
        userId,
        'floorplan-3d',
        {
          prompt,
          has_image: !!imagePath,
        },
        projectId
      );
    }

    // Update status to "generating"
    await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 0 });

    let currentImagePath = imagePath;
    const tempFiles: string[] = []; // Track temp files for cleanup

    try {
      // Step 1: Generate floorplan if needed
      if (!currentImagePath && prompt) {
        await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 20 });
        console.log(`[${userId}] Generating floorplan from prompt: ${prompt}`);
        currentImagePath = await this.generateFloorplan(prompt);
        tempFiles.push(currentImagePath);
        await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 40 });
      } else if (!currentImagePath) {
        throw new Error('Either image_path or prompt must be provided');
      }

      // Step 2: Convert to isometric
      await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 50 });
      console.log(`[${userId}] Converting to isometric view...`);
      const isometricPath = await this.convertToIsometric(currentImagePath);
      tempFiles.push(isometricPath);
      await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 70 });

      // Step 3: Generate 3D model
      // NOTE: Only 3D model generation charges credits (125 credits).
      // Image generation steps (floorplan generation, isometric conversion) are FREE.
      await this.updateGenerationStatus(generationId, 'generating', { progressPercentage: 75 });
      console.log(`[${userId}] Generating 3D model...`);
      const { glbPath, videoPath } = await this.generate3DModel(isometricPath);
      tempFiles.push(glbPath);
      if (videoPath) {
        tempFiles.push(videoPath);
      }

      // Step 4: Deduct credits AFTER successful 3D generation
      // Credits are only deducted after the 3D model is successfully generated.
      if (!devMode) {
        await deductCredits(userId, this.cost, {
          projectId,
          generationId,
          type: 'usage',
        });
      }

      const result = {
        floorplan_path: currentImagePath,
        isometric_path: isometricPath,
        model_path: glbPath,
        video_path: videoPath,
      };

      // Step 5: Update generation status to "completed"
      await this.updateGenerationStatus(generationId, 'completed', {
        progressPercentage: 100,
        outputData: result,
      });

      // Cleanup temp files
      this.cleanupTempFiles(tempFiles);

      return {
        generationId,
        result,
      };
    } catch (error: any) {
      // CRITICAL: Credits are NOT deducted here because the exception occurred
      // before the credit deduction point (which is only after successful 3D generation).

      // Cleanup temp files on error
      this.cleanupTempFiles(tempFiles);

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

