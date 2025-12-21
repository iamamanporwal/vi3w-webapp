import admin from './firebase-admin';
import type {
  ProjectDocument,
  GenerationDocument,
  TransactionDocument,
  PaymentOrderDocument,
  UserDocument,
  ProjectWithId,
  GenerationWithId,
  TransactionWithId,
  PaymentOrderWithId,
} from '@/types/firestore';

/**
 * Custom error classes for better error handling
 */
export class FirestoreError extends Error {
  constructor(message: string, public code?: string, public originalError?: any) {
    super(message);
    this.name = 'FirestoreError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation helpers
 */
function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new ValidationError('Invalid user ID: must be a non-empty string');
  }
  if (userId.length > 128) {
    throw new ValidationError('Invalid user ID: too long');
  }
}

function validateProjectId(projectId: string): void {
  if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new ValidationError('Invalid project ID: must be a non-empty string');
  }
}

function validateWorkflowType(workflowType: string): asserts workflowType is 'text-to-3d' | 'floorplan-3d' {
  if (workflowType !== 'text-to-3d' && workflowType !== 'floorplan-3d') {
    throw new ValidationError(`Invalid workflow type: ${workflowType}`);
  }
}

/**
 * Helper to remove undefined values from an object recursively
 */
function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }

  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = cleanUndefined(obj[key]);
    }
  }
  return cleaned;
}

function validateInputData(inputData: ProjectDocument['input_data']): void {
  if (!inputData || typeof inputData !== 'object') {
    throw new ValidationError('Invalid input_data: must be an object');
  }
  if (typeof inputData.has_image !== 'boolean') {
    throw new ValidationError('Invalid input_data: has_image must be a boolean');
  }
}

/**
 * Get Firestore client instance
 */
export function getFirestore() {
  try {
    const db = admin.firestore();
    if (!db) {
      console.error('[Firestore] Failed to get firestore instance from admin');
    }
    return db;
  } catch (error: any) {
    console.error('[Firestore] Error initializing firestore:', error);
    throw new FirestoreError('Failed to initialize Firestore client', 'INIT_ERROR', error);
  }
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<ProjectWithId | null> {
  try {
    validateProjectId(projectId);

    const db = getFirestore();
    const doc = await db.collection('projects').doc(projectId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return {
      id: doc.id,
      ...data,
    } as ProjectWithId;
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new FirestoreError(`Failed to get project: ${error.message}`, 'GET_PROJECT_ERROR', error);
  }
}

/**
 * Get projects by user ID, optionally filtered by workflow type
 */
export async function getProjectsByUserId(
  userId: string,
  workflowType?: 'text-to-3d' | 'floorplan-3d'
): Promise<ProjectWithId[]> {
  try {
    validateUserId(userId);

    if (workflowType) {
      validateWorkflowType(workflowType);
    }

    const db = getFirestore();
    let query = db.collection('projects').where('user_id', '==', userId);

    if (workflowType) {
      query = query.where('workflow_type', '==', workflowType);
    }

    query = query.orderBy('created_at', 'desc');

    console.log(`[Firestore] Fetching projects for user: ${userId}, workflow: ${workflowType || 'all'}`);
    const snapshot = await query.get();
    console.log(`[Firestore] Found ${snapshot.size} projects`);

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (!data) return null;
        return {
          id: doc.id,
          ...data,
        } as ProjectWithId;
      })
      .filter((item): item is ProjectWithId => item !== null);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    // Handle index not found errors gracefully
    if (error.code === 8 || error.message?.includes('index')) {
      // Fallback: query without orderBy if index doesn't exist
      try {
        const db = getFirestore();
        let query = db.collection('projects').where('user_id', '==', userId);
        if (workflowType) {
          query = query.where('workflow_type', '==', workflowType);
        }
        const snapshot = await query.get();
        return snapshot.docs
          .map(doc => {
            const data = doc.data();
            if (!data) return null;
            return { id: doc.id, ...data } as ProjectWithId;
          })
          .filter((item): item is ProjectWithId => item !== null)
          .sort((a, b) => {
            // Manual sort by created_at if available
            const aTime = a.created_at?.toMillis?.() || 0;
            const bTime = b.created_at?.toMillis?.() || 0;
            return bTime - aTime;
          });
      } catch (fallbackError: any) {
        throw new FirestoreError(`Failed to get projects: ${fallbackError.message}`, 'GET_PROJECTS_ERROR', fallbackError);
      }
    }
    throw new FirestoreError(`Failed to get projects: ${error.message}`, 'GET_PROJECTS_ERROR', error);
  }
}

/**
 * Create a new project
 */
export async function createProject(
  userId: string,
  workflowType: 'text-to-3d' | 'floorplan-3d',
  inputData: ProjectDocument['input_data'],
  title?: string
): Promise<ProjectWithId> {
  try {
    validateUserId(userId);
    validateWorkflowType(workflowType);
    validateInputData(inputData);

    if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
      throw new ValidationError('Invalid title: must be a string with max 200 characters');
    }

    const db = getFirestore();
    const now = admin.firestore.Timestamp.now();

    const projectData: any = {
      user_id: userId,
      workflow_type: workflowType,
      input_data: inputData,
      created_at: now,
      generation_count: 0,
    };

    if (title) {
      projectData.title = title.trim();
    }

    const docRef = await db.collection('projects').add(projectData);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new FirestoreError('Failed to create project: document not found after creation', 'CREATE_PROJECT_ERROR');
    }

    const data = doc.data();
    if (!data) {
      throw new FirestoreError('Failed to create project: document data is empty', 'CREATE_PROJECT_ERROR');
    }

    return {
      id: doc.id,
      ...data,
    } as ProjectWithId;
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to create project: ${error.message}`, 'CREATE_PROJECT_ERROR', error);
  }
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<ProjectDocument>
): Promise<void> {
  try {
    validateProjectId(projectId);

    if (!updates || Object.keys(updates).length === 0) {
      throw new ValidationError('Updates object cannot be empty');
    }

    // Validate specific fields if provided
    if (updates.workflow_type) {
      validateWorkflowType(updates.workflow_type);
    }
    if (updates.input_data) {
      validateInputData(updates.input_data);
    }
    if (updates.title !== undefined && (typeof updates.title !== 'string' || updates.title.length > 200)) {
      throw new ValidationError('Invalid title: must be a string with max 200 characters');
    }

    const db = getFirestore();
    const projectRef = db.collection('projects').doc(projectId);

    // Check if project exists
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      throw new FirestoreError(`Project not found: ${projectId}`, 'PROJECT_NOT_FOUND');
    }

    const updateData: any = {
      ...updates,
      updated_at: admin.firestore.Timestamp.now(),
    };

    await projectRef.update(updateData);
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to update project: ${error.message}`, 'UPDATE_PROJECT_ERROR', error);
  }
}

/**
 * Get a generation by ID
 */
export async function getGeneration(generationId: string): Promise<GenerationWithId | null> {
  try {
    if (!generationId || typeof generationId !== 'string' || generationId.trim().length === 0) {
      throw new ValidationError('Invalid generation ID: must be a non-empty string');
    }

    const db = getFirestore();
    const doc = await db.collection('generations').doc(generationId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return {
      id: doc.id,
      ...data,
    } as GenerationWithId;
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new FirestoreError(`Failed to get generation: ${error.message}`, 'GET_GENERATION_ERROR', error);
  }
}

/**
 * Get generations by user ID, optionally filtered by status and workflow type
 */
export async function getGenerationsByUserId(
  userId: string,
  status?: GenerationDocument['status'],
  workflowType?: 'text-to-3d' | 'floorplan-3d'
): Promise<GenerationWithId[]> {
  try {
    validateUserId(userId);

    if (status && !['pending', 'generating', 'completed', 'failed'].includes(status)) {
      throw new ValidationError(`Invalid status: ${status}`);
    }

    if (workflowType) {
      validateWorkflowType(workflowType);
    }

    const db = getFirestore();
    let query = db.collection('generations').where('user_id', '==', userId);

    if (status) {
      query = query.where('status', '==', status);
    }

    if (workflowType) {
      query = query.where('workflow_type', '==', workflowType);
    }

    query = query.orderBy('created_at', 'desc');

    const snapshot = await query.get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (!data) return null;
        return {
          id: doc.id,
          ...data,
        } as GenerationWithId;
      })
      .filter((item): item is GenerationWithId => item !== null);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new FirestoreError(`Failed to get generations: ${error.message}`, 'GET_GENERATIONS_ERROR', error);
  }
}

/**
 * Get all generations for a project (thread history)
 */
export async function getGenerationsByProjectId(
  projectId: string
): Promise<GenerationWithId[]> {
  try {
    validateProjectId(projectId);

    const db = getFirestore();
    const snapshot = await db
      .collection('generations')
      .where('project_id', '==', projectId)
      .orderBy('generation_number', 'desc')
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (!data) return null;
        return {
          id: doc.id,
          ...data,
        } as GenerationWithId;
      })
      .filter((item): item is GenerationWithId => item !== null);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new FirestoreError(`Failed to get project generations: ${error.message}`, 'GET_PROJECT_GENERATIONS_ERROR', error);
  }
}

/**
 * Create a new generation
 */
export async function createGeneration(
  userId: string,
  projectId: string,
  workflowType: 'text-to-3d' | 'floorplan-3d',
  inputData: GenerationDocument['input_data'],
  generationNumber: number
): Promise<GenerationWithId> {
  try {
    validateUserId(userId);
    validateProjectId(projectId);
    validateWorkflowType(workflowType);
    validateInputData(inputData);

    if (!Number.isInteger(generationNumber) || generationNumber < 1) {
      throw new ValidationError('Invalid generation number: must be a positive integer');
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw new FirestoreError(`Project not found: ${projectId}`, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== userId) {
      throw new FirestoreError('Unauthorized: project does not belong to user', 'UNAUTHORIZED');
    }

    const db = getFirestore();
    const now = admin.firestore.Timestamp.now();

    const generationData: any = {
      user_id: userId,
      project_id: projectId,
      workflow_type: workflowType,
      generation_number: generationNumber,
      status: 'pending',
      progress_percentage: 0,
      input_data: inputData,
      created_at: now,
    };

    const docRef = await db.collection('generations').add(generationData);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new FirestoreError('Failed to create generation: document not found after creation', 'CREATE_GENERATION_ERROR');
    }

    const data = doc.data();
    if (!data) {
      throw new FirestoreError('Failed to create generation: document data is empty', 'CREATE_GENERATION_ERROR');
    }

    return {
      id: doc.id,
      ...data,
    } as GenerationWithId;
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to create generation: ${error.message}`, 'CREATE_GENERATION_ERROR', error);
  }
}

/**
 * Update a generation
 */
export async function updateGeneration(
  generationId: string,
  updates: Partial<GenerationDocument>
): Promise<void> {
  try {
    if (!generationId || typeof generationId !== 'string' || generationId.trim().length === 0) {
      throw new ValidationError('Invalid generation ID: must be a non-empty string');
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new ValidationError('Updates object cannot be empty');
    }

    // Validate specific fields
    if (updates.status && !['pending', 'generating', 'completed', 'failed'].includes(updates.status)) {
      throw new ValidationError(`Invalid status: ${updates.status}`);
    }
    if (updates.progress_percentage !== undefined) {
      if (!Number.isFinite(updates.progress_percentage) || updates.progress_percentage < 0 || updates.progress_percentage > 100) {
        throw new ValidationError('Invalid progress_percentage: must be a number between 0 and 100');
      }
    }

    const db = getFirestore();
    const generationRef = db.collection('generations').doc(generationId);

    // Check if generation exists
    const generationDoc = await generationRef.get();
    if (!generationDoc.exists) {
      throw new FirestoreError(`Generation not found: ${generationId}`, 'GENERATION_NOT_FOUND');
    }

    const updateData: any = cleanUndefined({
      ...updates,
      updated_at: admin.firestore.Timestamp.now(),
    });

    await generationRef.update(updateData);
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to update generation: ${error.message}`, 'UPDATE_GENERATION_ERROR', error);
  }
}

/**
 * Get user document
 */
export async function getUser(userId: string): Promise<UserDocument | null> {
  try {
    validateUserId(userId);

    const db = getFirestore();
    const doc = await db.collection('users').doc(userId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return data as any as UserDocument;
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new FirestoreError(`Failed to get user: ${error.message}`, 'GET_USER_ERROR', error);
  }
}

/**
 * Create user with starter credits
 */
export async function createUserWithStarterCredits(
  userId: string,
  email: string,
  credits: number = 1250
): Promise<UserDocument> {
  try {
    validateUserId(userId);

    if (typeof email !== 'string') {
      throw new ValidationError('Invalid email: must be a string');
    }

    if (!Number.isFinite(credits) || credits < 0) {
      throw new ValidationError('Invalid credits: must be a non-negative number');
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);

    // Check if user already exists
    const existingUser = await userRef.get();
    if (existingUser.exists) {
      const data = existingUser.data();
      if (data) {
        return data as any as UserDocument;
      }
    }

    const now = admin.firestore.Timestamp.now();
    const userData: any = {
      email: email.trim(),
      credits: Math.floor(credits),
      created_at: now,
    };

    await userRef.set(userData);
    return userData as UserDocument;
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to create user: ${error.message}`, 'CREATE_USER_ERROR', error);
  }
}

/**
 * Get transactions by user ID
 */
export async function getTransactionsByUserId(
  userId: string,
  limit: number = 50
): Promise<TransactionWithId[]> {
  try {
    validateUserId(userId);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('Invalid limit: must be an integer between 1 and 100');
    }

    const db = getFirestore();
    const snapshot = await db
      .collection('transactions')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (!data) return null;
        return {
          id: doc.id,
          ...data,
        } as TransactionWithId;
      })
      .filter((item): item is TransactionWithId => item !== null);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new FirestoreError(`Failed to get transactions: ${error.message}`, 'GET_TRANSACTIONS_ERROR', error);
  }
}

/**
 * Create a transaction
 */
export async function createTransaction(
  transactionData: TransactionDocument
): Promise<TransactionWithId> {
  try {
    validateUserId(transactionData.user_id);

    if (!transactionData.type || !['purchase', 'usage'].includes(transactionData.type)) {
      throw new ValidationError(`Invalid transaction type: ${transactionData.type}`);
    }

    if (!Number.isFinite(transactionData.amount)) {
      throw new ValidationError('Invalid amount: must be a number');
    }

    if (!transactionData.status || !['pending', 'completed', 'failed'].includes(transactionData.status)) {
      throw new ValidationError(`Invalid status: ${transactionData.status}`);
    }

    const db = getFirestore();
    const now = admin.firestore.Timestamp.now();

    const data: any = {
      ...transactionData,
      created_at: now,
    };

    const docRef = await db.collection('transactions').add(data);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new FirestoreError('Failed to create transaction: document not found after creation', 'CREATE_TRANSACTION_ERROR');
    }

    const docData = doc.data();
    if (!docData) {
      throw new FirestoreError('Failed to create transaction: document data is empty', 'CREATE_TRANSACTION_ERROR');
    }

    return {
      id: doc.id,
      ...docData,
    } as TransactionWithId;
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to create transaction: ${error.message}`, 'CREATE_TRANSACTION_ERROR', error);
  }
}

/**
 * Get payment order by order ID
 */
export async function getPaymentOrder(orderId: string): Promise<PaymentOrderWithId | null> {
  try {
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      throw new ValidationError('Invalid order ID: must be a non-empty string');
    }

    const db = getFirestore();
    const snapshot = await db
      .collection('payment_orders')
      .where('order_id', '==', orderId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    if (!data) {
      return null;
    }

    return {
      id: doc.id,
      ...data,
    } as PaymentOrderWithId;
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new FirestoreError(`Failed to get payment order: ${error.message}`, 'GET_PAYMENT_ORDER_ERROR', error);
  }
}

/**
 * Create a payment order
 */
export async function createPaymentOrder(
  orderData: PaymentOrderDocument
): Promise<PaymentOrderWithId> {
  try {
    validateUserId(orderData.user_id);

    if (!orderData.order_id || typeof orderData.order_id !== 'string') {
      throw new ValidationError('Invalid order_id: must be a non-empty string');
    }

    if (!Number.isFinite(orderData.amount) || orderData.amount < 0) {
      throw new ValidationError('Invalid amount: must be a non-negative number');
    }

    if (!Number.isFinite(orderData.credits) || orderData.credits < 0) {
      throw new ValidationError('Invalid credits: must be a non-negative number');
    }

    if (!orderData.currency || typeof orderData.currency !== 'string') {
      throw new ValidationError('Invalid currency: must be a non-empty string');
    }

    if (!orderData.status || !['created', 'completed', 'failed'].includes(orderData.status)) {
      throw new ValidationError(`Invalid status: ${orderData.status}`);
    }

    const db = getFirestore();
    const now = admin.firestore.Timestamp.now();

    const data: any = {
      ...orderData,
      created_at: now,
    };

    const docRef = await db.collection('payment_orders').add(data);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new FirestoreError('Failed to create payment order: document not found after creation', 'CREATE_PAYMENT_ORDER_ERROR');
    }

    const docData = doc.data();
    if (!docData) {
      throw new FirestoreError('Failed to create payment order: document data is empty', 'CREATE_PAYMENT_ORDER_ERROR');
    }

    return {
      id: doc.id,
      ...docData,
    } as PaymentOrderWithId;
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to create payment order: ${error.message}`, 'CREATE_PAYMENT_ORDER_ERROR', error);
  }
}

/**
 * Update a payment order
 */
export async function updatePaymentOrder(
  orderId: string,
  updates: Partial<PaymentOrderDocument>
): Promise<void> {
  try {
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      throw new ValidationError('Invalid order ID: must be a non-empty string');
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new ValidationError('Updates object cannot be empty');
    }

    if (updates.status && !['created', 'completed', 'failed'].includes(updates.status)) {
      throw new ValidationError(`Invalid status: ${updates.status}`);
    }

    const db = getFirestore();
    const snapshot = await db
      .collection('payment_orders')
      .where('order_id', '==', orderId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new FirestoreError(`Payment order not found: ${orderId}`, 'PAYMENT_ORDER_NOT_FOUND');
    }

    const doc = snapshot.docs[0];
    const updateData: any = {
      ...updates,
      updated_at: admin.firestore.Timestamp.now(),
    };

    if (updates.status === 'completed' && !doc.data()?.completed_at) {
      updateData.completed_at = admin.firestore.Timestamp.now();
    }

    await doc.ref.update(updateData);
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof FirestoreError) {
      throw error;
    }
    throw new FirestoreError(`Failed to update payment order: ${error.message}`, 'UPDATE_PAYMENT_ORDER_ERROR', error);
  }
}
