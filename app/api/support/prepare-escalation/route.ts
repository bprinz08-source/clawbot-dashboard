import { NextResponse } from 'next/server';
import { appendSupportActionLog } from '@/lib/support-action-log';
import { normalizeSupportActionLogContext } from '@/lib/support-action-log-shared';
import { prepareSupportEscalation } from '@/lib/support';
import type { SupportEscalationInput } from '@/lib/support-shared';

function normalizeEscalationInput(payload: unknown): SupportEscalationInput | null {
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
    currentStatus:
      typeof record.currentStatus === 'string' ? record.currentStatus.trim() : '',
    classificationSummary:
      typeof record.classificationSummary === 'string'
        ? record.classificationSummary.trim()
        : '',
    accountContextSummary:
      typeof record.accountContextSummary === 'string'
        ? record.accountContextSummary.trim()
        : '',
    draftReplySummary:
      typeof record.draftReplySummary === 'string'
        ? record.draftReplySummary.trim()
        : '',
    priorNotes: typeof record.priorNotes === 'string' ? record.priorNotes.trim() : '',
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
    const input = normalizeEscalationInput(payload);

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid support escalation payload'
        },
        { status: 400 }
      );
    }

    const result = await prepareSupportEscalation(input);

    await appendSupportActionLog({
      loggedAt: new Date().toISOString(),
      ticketId: logContext.ticketId,
      customerName: logContext.customerName,
      customerEmail: logContext.customerEmail,
      subject: logContext.subject,
      actionType: 'prepare_escalation',
      actionStatus: 'success',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: logContext.needsHumanReview,
      summaryOrNote:
        result.escalation.escalation_summary ||
        result.escalation.escalation_title ||
        'Escalation prepared.',
      operatorSource: logContext.operatorSource
    }).catch((error) => {
      console.error('Failed to append support action log for prepare_escalation.', error);
    });

    return NextResponse.json({
      success: true,
      escalation: result.escalation,
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
      actionType: 'prepare_escalation',
      actionStatus: 'failed',
      resolutionStatus: logContext.resolutionStatus,
      resolvedAccountId: logContext.resolvedAccountId,
      resolvedPropertyId: logContext.resolvedPropertyId,
      resolvedBinderId: logContext.resolvedBinderId,
      needsHumanReview: logContext.needsHumanReview,
      summaryOrNote: error instanceof Error ? error.message : 'Support escalation failed.',
      operatorSource: logContext.operatorSource
    }).catch((logError) => {
      console.error(
        'Failed to append failed support action log for prepare_escalation.',
        logError
      );
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Support escalation failed.'
      },
      { status: 500 }
    );
  }
}
