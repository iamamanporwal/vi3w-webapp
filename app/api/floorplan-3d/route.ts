/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { FloorplanTo3DWorkflow } from '@/lib/workflows/floorplan3D';
import { ValidationError } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/floorplan-3d
 * 
 * Generate a 3D model from floorplan image or prompt
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({ status: 'ok' });
  /*
  try {
    // Authenticate user
    const userId = await requireAuth(request);

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    // ... (rest of the code)
  } catch (error: any) {
    // ...
  }
  */
}
