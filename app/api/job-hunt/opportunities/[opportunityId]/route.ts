import { NextResponse } from 'next/server';
import {
  findJobHuntRoleByOpportunityId,
  formatJobHuntStorageError,
  upsertJobHuntRole
} from '@/lib/job-hunt-storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const { opportunityId } = await params;
    const opportunity = await findJobHuntRoleByOpportunityId(
      decodeURIComponent(opportunityId)
    );

    if (!opportunity) {
      return NextResponse.json(
        {
          success: false,
          error: 'Opportunity not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const { opportunityId } = await params;
    const payload = await request.json();
    const opportunity = await upsertJobHuntRole({
      ...(payload && typeof payload === 'object' ? payload : {}),
      opportunity_id: decodeURIComponent(opportunityId)
    });

    return NextResponse.json({
      success: true,
      opportunity
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
