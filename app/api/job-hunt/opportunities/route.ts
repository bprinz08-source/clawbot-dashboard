import { NextResponse } from 'next/server';
import {
  formatJobHuntStorageError,
  getJobHuntStorageConfig,
  getJobHuntStorageTarget,
  readJobHuntRoles
} from '@/lib/job-hunt-storage';

export async function GET() {
  try {
    const opportunities = await readJobHuntRoles();

    return NextResponse.json({
      success: true,
      opportunities,
      source: getJobHuntStorageTarget(),
      storage: getJobHuntStorageConfig()
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: formatJobHuntStorageError(error)
      },
      { status: 500 }
    );
  }
}
