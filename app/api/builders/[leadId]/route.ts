import { NextResponse } from 'next/server';
import {
  BUILDER_DETAIL_COLUMNS,
  MUTABLE_BUILDER_COLUMNS
} from '@/lib/builder-schema';
import {
  formatBuilderStorageError,
  findBuilderRecordByLeadId,
  updateBuilderRecord
} from '@/lib/builder-storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const builder = await findBuilderRecordByLeadId(decodeURIComponent(leadId));

    if (!builder) {
      return NextResponse.json({
        success: false,
        error: 'Builder not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      builder,
      detailColumns: BUILDER_DETAIL_COLUMNS,
      mutableColumns: MUTABLE_BUILDER_COLUMNS
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: formatBuilderStorageError(error)
    }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const payload = await request.json();
    const builder = await updateBuilderRecord(
      decodeURIComponent(leadId),
      payload && typeof payload === 'object' ? payload : {}
    );

    if (!builder) {
      return NextResponse.json({
        success: false,
        error: 'Builder not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      builder
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: formatBuilderStorageError(error)
    }, { status: 500 });
  }
}
