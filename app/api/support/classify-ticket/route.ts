import { NextResponse } from 'next/server';
import { appendSupportActionLog } from '@/lib/support-action-log';
import { normalizeSupportActionLogContext } from '@/lib/support-action-log-shared';
import { classifySupportTicket } from '@/lib/support';
import type { SupportTicketClassificationInput } from '@/lib/support-shared';

function normalizeSupportTicketInput(
  payload: unknown
): SupportTicketClassificationInput | null {
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
    subject: typeof record.subject === 'string' ? record.subject.trim() : '',
    body,
    threadTranscript:
      typeof record.threadTranscript === 'string' ? record.threadTranscript.trim() : '',
    channel: typeof record.channel === 'string' ? record.channel.trim() : '',
    customerName:
      typeof record.customerName === 'string' ? record.customerName.trim() : '',
    accountId: typeof record.accountId === 'string' ? record.accountId.trim() : '',
    currentStatus:
      typeof record.currentStatus === 'string' ? record.currentStatus.trim() : '',
    priorNotes: typeof record.priorNotes === 'string' ? record.priorNotes.trim() : ''
  };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const logContext = normalizeSupportActionLogContext(payload);

  try {
    const input = normalizeSupportTicketInput(payload);

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid support ticket payload'
        },
        { status: 400 }
      );
    }

    const result = await classifySupportTicket(input);

    await appendSupportActionLog({
      loggedAt: new Date().toISOString(),
      ticketId: logContext.ticketId,
      customerName: logContext.customerName,
      customerEmail: logContext.customerEmail,
      subject: logContext.subject,
      actionType: 'classify_ticket',
      actionStatus: 'success',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: result.classification.needs_human_review,
      summaryOrNote:
        result.classification.recommended_next_step ||
        result.classification.issue_type ||
        'Classification completed.',
      operatorSource: logContext.operatorSource
    }).catch((error) => {
      console.error('Failed to append support action log for classify_ticket.', error);
    });

    return NextResponse.json({
      success: true,
      classification: result.classification,
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
      actionType: 'classify_ticket',
      actionStatus: 'failed',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: logContext.needsHumanReview,
      summaryOrNote:
        error instanceof Error ? error.message : 'Support classification failed.',
      operatorSource: logContext.operatorSource
    }).catch((logError) => {
      console.error('Failed to append failed support action log for classify_ticket.', logError);
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Support classification failed.'
      },
      { status: 500 }
    );
  }
}
