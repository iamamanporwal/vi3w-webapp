import { Timestamp } from 'firebase/firestore';

/**
 * Firestore Database Schema Type Definitions
 * 
 * These types match the Firestore collections structure as defined in the PRD.
 * All timestamps use Firestore's Timestamp type.
 */

// ============================================================================
// Users Collection
// ============================================================================

export interface UserDocument {
  credits: number;           // Current credit balance
  email: string;             // User email
  created_at: Timestamp;     // Account creation date
  updated_at?: Timestamp;    // Last update
}

// ============================================================================
// Projects Collection
// ============================================================================

export type WorkflowType = 'text-to-3d' | 'floorplan-3d';

export interface ProjectInputData {
  prompt?: string;
  image_path?: string;
  has_image: boolean;
}

export interface ProjectOutputData {
  model_url?: string;
  model_path?: string;
  image_url?: string;
  isometric_path?: string;
  floorplan_path?: string;
  preview_video_path?: string;
}

export interface ProjectDocument {
  user_id: string;                    // Firebase Auth UID
  workflow_type: WorkflowType;        // 'text-to-3d' | 'floorplan-3d'
  title?: string;                     // Optional project title
  input_data: ProjectInputData;
  output_data?: ProjectOutputData;
  created_at: Timestamp;
  updated_at?: Timestamp;
  generation_count: number;           // Number of generations for this project
  latest_generation_id?: string;      // ID of the most recent generation
}

// ============================================================================
// Generations Collection
// ============================================================================

export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface GenerationInputData {
  prompt?: string;
  image_path?: string;
  has_image: boolean;
}

export interface GenerationOutputData {
  model_url?: string;
  model_path?: string;
  image_url?: string;
  isometric_path?: string;
  floorplan_path?: string;
  preview_video_path?: string;
  meshy_task_id?: string;
  replicate_prediction_id?: string;
}

export interface GenerationDocument {
  user_id: string;
  project_id: string;
  workflow_type: WorkflowType;
  generation_number: number;          // Sequential: 1, 2, 3...
  status: GenerationStatus;            // 'pending' | 'generating' | 'completed' | 'failed'
  progress_percentage: number;        // 0-100
  input_data: GenerationInputData;
  output_data?: GenerationOutputData;
  error_message?: string;
  created_at: Timestamp;
  updated_at?: Timestamp;
}

// ============================================================================
// Transactions Collection
// ============================================================================

export type TransactionType = 'purchase' | 'usage';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface TransactionDocument {
  user_id: string;
  type: TransactionType;              // 'purchase' | 'usage'
  amount: number;                     // Credits
  status: TransactionStatus;          // 'pending' | 'completed' | 'failed'
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  project_id?: string;
  generation_id?: string;
  metadata?: Record<string, any>;     // Additional metadata
  created_at: Timestamp;
}

// ============================================================================
// Payment Orders Collection
// ============================================================================

export type PaymentOrderStatus = 'created' | 'completed' | 'failed';

export interface PaymentOrderDocument {
  user_id: string;
  order_id: string;                   // Razorpay order ID
  amount: number;                      // Amount in paise
  currency: string;                    // 'INR'
  credits: number;                     // Credits to grant
  status: PaymentOrderStatus;         // 'created' | 'completed' | 'failed'
  payment_id?: string;
  created_at: Timestamp;
  completed_at?: Timestamp;
}

// ============================================================================
// Helper Types for API Responses
// ============================================================================

/**
 * Project with ID (for API responses)
 */
export interface ProjectWithId extends ProjectDocument {
  id: string;
}

/**
 * Generation with ID (for API responses)
 */
export interface GenerationWithId extends GenerationDocument {
  id: string;
}

/**
 * Transaction with ID (for API responses)
 */
export interface TransactionWithId extends TransactionDocument {
  id: string;
}

/**
 * Payment Order with ID (for API responses)
 */
export interface PaymentOrderWithId extends PaymentOrderDocument {
  id: string;
}

