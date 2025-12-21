import admin from './firebase-admin';
import path from 'path';

/**
 * Custom error classes
 */
export class StorageError extends Error {
  constructor(message: string, public code?: string, public originalError?: any) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Configuration constants
 */
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'model/gltf-binary',
  'model/gltf+json',
  'application/octet-stream',
  'video/mp4',
  'application/json',
];

/**
 * Get Firebase Storage bucket
 */
function getBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new StorageError('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set', 'BUCKET_NOT_CONFIGURED');
  }
  try {
    return admin.storage().bucket(bucketName);
  } catch (error: any) {
    throw new StorageError(`Failed to get storage bucket: ${error.message}`, 'BUCKET_ERROR', error);
  }
}

/**
 * Validate and sanitize storage path to prevent path traversal attacks
 */
function validateStoragePath(storagePath: string): string {
  if (!storagePath || typeof storagePath !== 'string') {
    throw new StorageError('Storage path must be a non-empty string', 'INVALID_PATH');
  }
  
  // Normalize path
  const normalized = path.normalize(storagePath).replace(/\\/g, '/');
  
  // Remove leading slashes
  const cleaned = normalized.replace(/^\/+/, '');
  
  // Check for path traversal attempts
  if (cleaned.includes('..') || cleaned.includes('//')) {
    throw new StorageError('Invalid storage path: path traversal detected', 'PATH_TRAVERSAL');
  }
  
  // Check for empty path
  if (cleaned.length === 0) {
    throw new StorageError('Storage path cannot be empty', 'EMPTY_PATH');
  }
  
  // Check path length
  if (cleaned.length > 1024) {
    throw new StorageError('Storage path too long (max 1024 characters)', 'PATH_TOO_LONG');
  }
  
  return cleaned;
}

/**
 * Validate content type
 */
function validateContentType(contentType: string): void {
  if (!contentType || typeof contentType !== 'string') {
    throw new StorageError('Content type must be a non-empty string', 'INVALID_CONTENT_TYPE');
  }
  
  // Allow if it's in the allowed list or starts with allowed prefix
  const isAllowed = ALLOWED_CONTENT_TYPES.some(allowed => 
    contentType === allowed || contentType.startsWith(allowed.split('/')[0] + '/')
  );
  
  if (!isAllowed) {
    throw new StorageError(`Content type not allowed: ${contentType}`, 'CONTENT_TYPE_NOT_ALLOWED');
  }
}

/**
 * Validate file size
 */
function validateFileSize(size: number): void {
  if (!Number.isFinite(size) || size < 0) {
    throw new StorageError('Invalid file size: must be a non-negative number', 'INVALID_FILE_SIZE');
  }
  if (size > MAX_FILE_SIZE) {
    throw new StorageError(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024} MB`, 'FILE_TOO_LARGE');
  }
}

/**
 * Generate storage path for generation files
 * Format: users/{userId}/projects/{projectId}/generations/{generationNumber}/{filename}
 */
export function getGenerationStoragePath(
  userId: string,
  projectId: string,
  generationNumber: number,
  filename: string
): string {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new StorageError('Invalid user ID', 'INVALID_USER_ID');
    }
    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
      throw new StorageError('Invalid project ID', 'INVALID_PROJECT_ID');
    }
    if (!Number.isInteger(generationNumber) || generationNumber < 1) {
      throw new StorageError('Invalid generation number: must be a positive integer', 'INVALID_GENERATION_NUMBER');
    }
    if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
      throw new StorageError('Invalid filename', 'INVALID_FILENAME');
    }
    
    // Sanitize filename (remove path separators and dangerous characters)
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 255); // Limit filename length
    
    const storagePath = `users/${userId}/projects/${projectId}/generations/${generationNumber}/${sanitizedFilename}`;
    return validateStoragePath(storagePath);
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to generate storage path: ${error.message}`, 'PATH_GENERATION_ERROR', error);
  }
}

/**
 * Upload a file from local file path to Firebase Storage
 */
export async function uploadToStorage(
  filePath: string,
  destinationPath: string,
  contentType?: string
): Promise<string> {
  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new StorageError('File path must be a non-empty string', 'INVALID_FILE_PATH');
    }
    
    const validatedPath = validateStoragePath(destinationPath);
    
    if (contentType) {
      validateContentType(contentType);
    }
    
    const bucket = getBucket();
    const file = bucket.file(validatedPath);
    
    const options: any = {
      destination: validatedPath,
      metadata: {
        cacheControl: 'public, max-age=31536000', // 1 year
      },
    };
    
    if (contentType) {
      options.metadata.contentType = contentType;
    }
    
    // Upload file
    await bucket.upload(filePath, options);
    
    // Make file publicly accessible
    try {
      await file.makePublic();
    } catch (publicError: any) {
      // If making public fails, try to delete the uploaded file
      try {
        await file.delete();
      } catch (deleteError) {
        // Log but don't throw - file exists but not public
        console.error('Failed to delete file after public access error:', deleteError);
      }
      throw new StorageError(`Failed to make file public: ${publicError.message}`, 'MAKE_PUBLIC_ERROR', publicError);
    }
    
    return getPublicUrl(validatedPath);
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to upload file: ${error.message}`, 'UPLOAD_ERROR', error);
  }
}

/**
 * Upload a buffer to Firebase Storage
 */
export async function uploadBuffer(
  buffer: Buffer,
  destinationPath: string,
  contentType: string
): Promise<string> {
  try {
    if (!Buffer.isBuffer(buffer)) {
      throw new StorageError('Invalid buffer: must be a Buffer instance', 'INVALID_BUFFER');
    }
    
    validateFileSize(buffer.length);
    validateContentType(contentType);
    const validatedPath = validateStoragePath(destinationPath);
    
    const bucket = getBucket();
    const file = bucket.file(validatedPath);
    
    // Upload buffer
    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
      },
      public: true,
    });
    
    return getPublicUrl(validatedPath);
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to upload buffer: ${error.message}`, 'UPLOAD_BUFFER_ERROR', error);
  }
}

/**
 * Get public URL for a file in Firebase Storage
 */
export function getPublicUrl(storagePath: string): string {
  try {
    const validatedPath = validateStoragePath(storagePath);
    const bucket = getBucket();
    const file = bucket.file(validatedPath);
    
    // Use the public URL format
    return `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(validatedPath)}`;
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to get public URL: ${error.message}`, 'GET_URL_ERROR', error);
  }
}

/**
 * Delete a file from Firebase Storage
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  try {
    const validatedPath = validateStoragePath(storagePath);
    const bucket = getBucket();
    const file = bucket.file(validatedPath);
    
    // Check if file exists first
    const [exists] = await file.exists();
    if (!exists) {
      // File doesn't exist, consider it a success (idempotent)
      return;
    }
    
    await file.delete();
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    // If file doesn't exist, that's okay (idempotent operation)
    if (error.code === 404 || error.message?.includes('No such object')) {
      return;
    }
    throw new StorageError(`Failed to delete file: ${error.message}`, 'DELETE_ERROR', error);
  }
}

/**
 * Check if a file exists in Firebase Storage
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    const validatedPath = validateStoragePath(storagePath);
    const bucket = getBucket();
    const file = bucket.file(validatedPath);
    const [exists] = await file.exists();
    return exists;
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    // If there's an error checking, assume file doesn't exist
    return false;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(storagePath: string) {
  try {
    const validatedPath = validateStoragePath(storagePath);
    const bucket = getBucket();
    const file = bucket.file(validatedPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new StorageError(`File not found: ${validatedPath}`, 'FILE_NOT_FOUND');
    }
    
    const [metadata] = await file.getMetadata();
    return metadata;
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to get file metadata: ${error.message}`, 'GET_METADATA_ERROR', error);
  }
}

/**
 * Copy a file in Firebase Storage
 */
export async function copyFile(sourcePath: string, destinationPath: string): Promise<string> {
  try {
    const validatedSource = validateStoragePath(sourcePath);
    const validatedDest = validateStoragePath(destinationPath);
    
    const bucket = getBucket();
    const sourceFile = bucket.file(validatedSource);
    const destFile = bucket.file(validatedDest);
    
    // Check if source exists
    const [exists] = await sourceFile.exists();
    if (!exists) {
      throw new StorageError(`Source file not found: ${validatedSource}`, 'SOURCE_NOT_FOUND');
    }
    
    // Copy file
    await sourceFile.copy(destFile);
    
    // Make destination public if source was public
    try {
      await destFile.makePublic();
    } catch {
      // If making public fails, that's okay - file is still copied
    }
    
    return getPublicUrl(validatedDest);
  } catch (error: any) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to copy file: ${error.message}`, 'COPY_ERROR', error);
  }
}
