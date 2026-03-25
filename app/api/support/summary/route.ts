import { NextResponse } from 'next/server';
import { getSupportQueueSummary } from '@/lib/support-queue-summary';

export async function GET() {
  try {
    const summary = await getSupportQueueSummary();

    return NextResponse.json({
      success: true,
      summary
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to load support summary.'
      },
      { status: 500 }
    );
  }
}
