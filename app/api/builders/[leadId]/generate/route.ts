import { NextResponse } from 'next/server';
import {
  generateBuilderDraft
} from '@/lib/builder-ai';
import { AI_DRAFT_FIELDS, type AiDraftField } from '@/lib/builder-ai-shared';
import {
  findBuilderRecordByLeadId,
  formatBuilderStorageError,
  updateBuilderRecord
} from '@/lib/builder-storage';

function isAiDraftField(value: unknown): value is AiDraftField {
  return typeof value === 'string' && AI_DRAFT_FIELDS.includes(value as AiDraftField);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const decodedLeadId = decodeURIComponent(leadId);
    const payload = await request.json().catch(() => null);
    const draftField = payload && typeof payload === 'object' ? payload.draftField : null;

    if (!isAiDraftField(draftField)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid draft field'
        },
        { status: 400 }
      );
    }

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

    const generatedText = await generateBuilderDraft(builder, draftField);
    const updatedBuilder = await updateBuilderRecord(decodedLeadId, {
      [draftField]: generatedText
    });

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
      draftField,
      generatedText,
      builder: updatedBuilder
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
