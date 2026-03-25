import { NextResponse } from 'next/server';
import { appendSupportActionLog } from '@/lib/support-action-log';
import { normalizeSupportActionLogContext } from '@/lib/support-action-log-shared';
import { draftSupportReply } from '@/lib/support';
import type { SupportReplyDraftInput } from '@/lib/support-shared';

function normalizeReplyDraftInput(payload: unknown): SupportReplyDraftInput | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const body = typeof record.body === 'string' ? record.body.trim() : '';

  if (!body) {
    return null;
  }

  return {
    ticketId: typeof record.ticketId === 'string' ? record.ticketId.trim() : '',
    accountId: typeof record.accountId === 'string' ? record.accountId.trim() : '',
    customerName:
      typeof record.customerName === 'string' ? record.customerName.trim() : '',
    subject: typeof record.subject === 'string' ? record.subject.trim() : '',
    body,
    threadTranscript:
      typeof record.threadTranscript === 'string' ? record.threadTranscript.trim() : '',
    channel: typeof record.channel === 'string' ? record.channel.trim() : '',
    currentStatus:
      typeof record.currentStatus === 'string' ? record.currentStatus.trim() : '',
    priorNotes: typeof record.priorNotes === 'string' ? record.priorNotes.trim() : '',
    accountContextSummary:
      typeof record.accountContextSummary === 'string'
        ? record.accountContextSummary.trim()
        : '',
    internalGuidance:
      typeof record.internalGuidance === 'string'
        ? record.internalGuidance.trim()
        : ''
  };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const logContext = normalizeSupportActionLogContext(payload);

  try {
    const input = normalizeReplyDraftInput(payload);

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid support reply draft payload'
        },
        { status: 400 }
      );
    }

    const result = await draftSupportReply(input);

    await appendSupportActionLog({
      loggedAt: new Date().toISOString(),
      ticketId: logContext.ticketId,
      customerName: logContext.customerName,
      customerEmail: logContext.customerEmail,
      subject: logContext.subject,
      actionType: 'draft_support_reply',
      actionStatus: 'success',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: result.draft.needs_human_review,
      summaryOrNote: result.draft.subject || result.draft.reply_body || 'Reply drafted.',
      operatorSource: logContext.operatorSource
    }).catch((error) => {
      console.error('Failed to append support action log for draft_support_reply.', error);
    });

    return NextResponse.json({
      success: true,
      draft: result.draft,
      execution: {
        workspaceId: result.execution.workspaceId,
        actionId: result.execution.actionId,
        durationMs: result.execution.durationMs,
        attempts: result.execution.attempts,
        requiresApproval: result.execution.requiresApproval,
        draftOnly: result.execution.draftOnly
      }
    });
  } catch (error: unknown) {
    await appendSupportActionLog({
      loggedAt: new Date().toISOString(),
      ticketId: logContext.ticketId,
      customerName: logContext.customerName,
      customerEmail: logContext.customerEmail,
      subject: logContext.subject,
      actionType: 'draft_support_reply',
      actionStatus: 'failed',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: logContext.needsHumanReview,
      summaryOrNote: error instanceof Error ? error.message : 'Support reply draft failed.',
      operatorSource: logContext.operatorSource
    }).catch((logError) => {
      console.error(
        'Failed to append failed support action log for draft_support_reply.',
        logError
      );
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Support reply draft failed.'
      },
      { status: 500 }
    );
  }
}
