import { NextResponse } from 'next/server';
import { listSupportQueueItems } from '@/lib/support-operator';

export async function GET() {
  try {
    const tickets = await listSupportQueueItems();

    return NextResponse.json({
      success: true,
      tickets
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load support tickets.'
      },
      { status: 500 }
    );
  }
}
