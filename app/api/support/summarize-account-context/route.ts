import { NextResponse } from 'next/server';
import { appendSupportActionLog } from '@/lib/support-action-log';
import { normalizeSupportActionLogContext } from '@/lib/support-action-log-shared';
import { summarizeSupportAccountContext } from '@/lib/support';
import type { SupportAccountContextSummaryInput } from '@/lib/support-shared';

function normalizeAccountContextInput(
  payload: unknown
): SupportAccountContextSummaryInput | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const input: SupportAccountContextSummaryInput = {
    accountId: typeof record.accountId === 'string' ? record.accountId.trim() : '',
    customerName:
      typeof record.customerName === 'string' ? record.customerName.trim() : '',
    ticketId: typeof record.ticketId === 'string' ? record.ticketId.trim() : '',
    subject: typeof record.subject === 'string' ? record.subject.trim() : '',
    body: typeof record.body === 'string' ? record.body.trim() : '',
    threadTranscript:
      typeof record.threadTranscript === 'string' ? record.threadTranscript.trim() : '',
    currentStatus:
      typeof record.currentStatus === 'string' ? record.currentStatus.trim() : '',
    planOrTier: typeof record.planOrTier === 'string' ? record.planOrTier.trim() : '',
    priorNotes: typeof record.priorNotes === 'string' ? record.priorNotes.trim() : '',
    recentActivity:
      typeof record.recentActivity === 'string' ? record.recentActivity.trim() : '',
    relevantRecords:
      typeof record.relevantRecords === 'string' ? record.relevantRecords.trim() : '',
    accountSnapshot:
      typeof record.accountSnapshot === 'string' ? record.accountSnapshot.trim() : ''
  };

  const hasUsableContext = Object.values(input).some(
    (value) => typeof value === 'string' && value.length > 0
  );

  return hasUsableContext ? input : null;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const logContext = normalizeSupportActionLogContext(payload);

  try {
    const input = normalizeAccountContextInput(payload);

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid support account context payload'
        },
        { status: 400 }
      );
    }

    const result = await summarizeSupportAccountContext(input);

    await appendSupportActionLog({
      loggedAt: new Date().toISOString(),
      ticketId: logContext.ticketId,
      customerName: logContext.customerName,
      customerEmail: logContext.customerEmail,
      subject: logContext.subject,
      actionType: 'summarize_account_context',
      actionStatus: 'success',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: logContext.needsHumanReview,
      summaryOrNote:
        result.summary.recommended_support_context ||
        result.summary.customer ||
        'Account context summarized.',
      operatorSource: logContext.operatorSource
    }).catch((error) => {
      console.error(
        'Failed to append support action log for summarize_account_context.',
        error
      );
    });

    return NextResponse.json({
      success: true,
      summary: result.summary,
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
      actionType: 'summarize_account_context',
      actionStatus: 'failed',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: logContext.needsHumanReview,
      summaryOrNote:
        error instanceof Error
          ? error.message
          : 'Support account context summary failed.',
      operatorSource: logContext.operatorSource
    }).catch((logError) => {
      console.error(
        'Failed to append failed support action log for summarize_account_context.',
        logError
      );
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Support account context summary failed.'
      },
      { status: 500 }
    );
  }
}
