import { NextResponse } from 'next/server';
import {
  findBestContact,
  recommendedContactResultToPatch
} from '@/lib/builder-contact';
import {
  findBuilderRecordByLeadId,
  formatBuilderStorageError,
  updateBuilderRecord
} from '@/lib/builder-storage';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const decodedLeadId = decodeURIComponent(leadId);
    const builder = await findBuilderRecordByLeadId(decodedLeadId);

    if (!builder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Builder not found'
        },
        { status: 404 }
      );
    }

    const contactResult = await findBestContact(builder);
    const updatedBuilder = await updateBuilderRecord(
      decodedLeadId,
      recommendedContactResultToPatch(contactResult)
    );

    if (!updatedBuilder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Builder not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      builder: updatedBuilder,
      contact: contactResult
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: formatBuilderStorageError(error)
      },
      { status: 500 }
    );
  }
}
