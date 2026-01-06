import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('URL is required', { status: 400 });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return new NextResponse(`Failed to fetch from source: ${response.statusText}`, { status: response.status });
        }

        const contentType = response.headers.get('content-type');
        const blob = await response.blob();

        return new NextResponse(blob, {
            headers: {
                'Content-Type': contentType || 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error: any) {
        console.error('Proxy error:', error);
        return new NextResponse(`Proxy error: ${error.message}`, { status: 500 });
    }
}
