import type { WorkflowType, GenerationInputData } from '@/types/firestore';
import {
  getFirestore,
  createGeneration,
  updateGeneration,
  getProject,
  createProject,
  updateProject,
} from '@/lib/server/firestore';
import admin from '@/lib/server/firebase-admin';

/**
 * Base Workflow Class
 * 
 * Provides common functionality for all workflows:
 * - Generation event creation and management
 * - Project management
 * - Generation numbering
 * - Status updates
 */
export abstract class BaseWorkflow {
  abstract readonly name: string;
  abstract readonly cost: number; // Cost in credits per generation

  /**
   * Create a generation event in Firestore
   */
  async createGenerationEvent(
    userId: string,
    workflowType: WorkflowType,
    inputData: GenerationInputData,
    projectId?: string
  ): Promise<string> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('Invalid user ID');
    }
    if (workflowType !== 'text-to-3d' && workflowType !== 'floorplan-3d') {
      throw new Error(`Invalid workflow type: ${workflowType}`);
    }
    if (!inputData || typeof inputData !== 'object') {
      throw new Error('Invalid input data');
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();

      const generationData: any = {
        user_id: userId,
        workflow_type: workflowType,
        status: 'pending',
        progress_percentage: 0,
        input_data: inputData,
        created_at: now,
        updated_at: now,
      };

      if (projectId) {
        if (typeof projectId !== 'string' || projectId.trim().length === 0) {
          throw new Error('Invalid project ID');
        }
        generationData.project_id = projectId;
      }

      const docRef = await db.collection('generations').add(generationData);
      const generationId = docRef.id;

      console.log(`[${userId}] Created generation event ${generationId} with status 'pending'`);
      return generationId;
    } catch (error: any) {
      console.error('Error creating generation event:', error);
      const errorMessage = error.message || 'Unknown error';
      throw new Error(`Failed to create generation event: ${errorMessage}`);
    }
  }

  /**
   * Update generation status and progress
   */
  async updateGenerationStatus(
    generationId: string,
    status: 'pending' | 'generating' | 'completed' | 'failed',
    options?: {
      progressPercentage?: number;
      outputData?: any;
      errorMessage?: string;
    }
  ): Promise<void> {
    if (!generationId || typeof generationId !== 'string' || generationId.trim().length === 0) {
      console.error('Invalid generation ID for status update');
      return;
    }

    const validStatuses = ['pending', 'generating', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      console.error(`Invalid status: ${status}`);
      return;
    }

    try {
      const progress = options?.progressPercentage ?? 0;
      if (progress < 0 || progress > 100) {
        console.warn(`Invalid progress percentage: ${progress}, clamping to 0-100`);
      }

      const updateData: any = {
        status,
        progress_percentage: Math.max(0, Math.min(100, progress)),
      };

      // CRITICAL FIX: Use nested field updates (dot notation) for output_data
      // This ensures existing fields like meshy_task_id are preserved
      if (options?.outputData !== undefined) {
        // Instead of replacing the entire output_data object, update each field individually
        const outputDataKeys = Object.keys(options.outputData);
        console.log(`[BaseWorkflow] Updating output_data with fields: ${outputDataKeys.join(', ')}`);

        for (const [key, value] of Object.entries(options.outputData)) {
          updateData[`output_data.${key}`] = value;
        }
      }

      if (options?.errorMessage !== undefined) {
        updateData.error_message = options.errorMessage;
      }

      await updateGeneration(generationId, updateData);

      console.log(
        `Updated generation ${generationId} to status '${status}' (progress: ${Math.max(0, Math.min(100, progress))}%)`
      );
    } catch (error: any) {
      console.error('Error updating generation status:', error);
      // Don't throw - this is a non-critical operation, but log for debugging
    }
  }

  /**
   * Get or create a project
   */
  async getOrCreateProject(
    userId: string,
    workflowType: WorkflowType,
    projectId?: string,
    title?: string
  ): Promise<string> {
    try {
      // If projectId provided, verify it exists and belongs to user
      if (projectId) {
        const project = await getProject(projectId);
        if (project && project.user_id === userId) {
          return projectId;
        }
        console.log(`Project ${projectId} does not belong to user ${userId} or doesn't exist`);
        // Fall through to create new project
      }

      // Create new project
      const project = await createProject(
        userId,
        workflowType,
        {
          has_image: false,
        },
        title
      );

      console.log(`[${userId}] Created new project ${project.id} for workflow ${workflowType}`);
      return project.id;
    } catch (error: any) {
      console.error('Error getting/creating project:', error);
      throw new Error(`Failed to get or create project: ${error.message}`);
    }
  }

  /**
   * Assign generation number to a generation within a project
   * Uses atomic increment to ensure thread-safety
   */
  async assignGenerationNumber(projectId: string, generationId: string): Promise<number> {
    try {
      const db = getFirestore();
      const projectRef = db.collection('projects').doc(projectId);
      const generationRef = db.collection('generations').doc(generationId);

      // Use transaction to atomically increment generation count
      const newNumber = await db.runTransaction(async (transaction) => {
        const projectDoc = await transaction.get(projectRef);

        if (!projectDoc.exists) {
          throw new Error(`Project ${projectId} does not exist`);
        }

        const projectData = projectDoc.data();
        const currentCount = projectData?.generation_count ?? 0;
        const newGenerationNumber = currentCount + 1;

        // Update project: increment count atomically and set latest generation
        transaction.update(projectRef, {
          generation_count: admin.firestore.FieldValue.increment(1),
          latest_generation_id: generationId,
          updated_at: admin.firestore.Timestamp.now(),
        });

        // Update generation: set generation_number and project_id
        transaction.update(generationRef, {
          generation_number: newGenerationNumber,
          project_id: projectId,
        });

        return newGenerationNumber;
      });

      console.log(
        `Assigned generation number ${newNumber} to generation ${generationId} in project ${projectId}`
      );
      return newNumber;
    } catch (error: any) {
      console.error('Error assigning generation number:', error);
      throw new Error(`Failed to assign generation number: ${error.message}`);
    }
  }

  /**
   * Link generation to project and update project metadata
   */
  async linkGenerationToProject(generationId: string, projectId: string): Promise<void> {
    try {
      const db = getFirestore();
      const projectRef = db.collection('projects').doc(projectId);
      const generationRef = db.collection('generations').doc(generationId);

      // Verify both documents exist
      const [projectDoc, generationDoc] = await Promise.all([
        projectRef.get(),
        generationRef.get(),
      ]);

      if (!projectDoc.exists) {
        throw new Error(`Project ${projectId} does not exist`);
      }
      if (!generationDoc.exists) {
        throw new Error(`Generation ${generationId} does not exist`);
      }

      // Update project: set latest generation
      await projectRef.update({
        latest_generation_id: generationId,
        updated_at: admin.firestore.Timestamp.now(),
      });

      // Update generation: ensure project_id is set
      await generationRef.update({
        project_id: projectId,
      });

      console.log(`Linked generation ${generationId} to project ${projectId}`);
    } catch (error: any) {
      console.error('Error linking generation to project:', error);
      throw new Error(`Failed to link generation to project: ${error.message}`);
    }
  }

  /**
   * Abstract method: Run the workflow
   * Must be implemented by subclasses
   */
  abstract run(
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
  }>;
}

