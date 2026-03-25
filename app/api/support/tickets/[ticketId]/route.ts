import { NextResponse } from 'next/server';
import {
  getSupportTicketDetail,
  saveSupportTicketDraft
} from '@/lib/support-operator';
import {
  SUPPORT_STATUSES,
  type SupportStatus,
  type SupportTicketDraftPatch
} from '@/lib/support-operator-shared';

function isSupportStatus(value: unknown): value is SupportStatus {
  return typeof value === 'string' && SUPPORT_STATUSES.includes(value as SupportStatus);
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function normalizeDraftPatch(payload: unknown): SupportTicketDraftPatch | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const currentStatus = record.currentStatus;
  const body = normalizeString(record.body);

  if (!isSupportStatus(currentStatus) || !body) {
    return null;
  }

    return {
      customerName: normalizeString(record.customerName),
      accountId: normalizeString(record.accountId),
      propertyId: normalizeString(record.propertyId),
      binderId: normalizeString(record.binderId),
      resolvedContactId: normalizeString(record.resolvedContactId),
      subject: normalizeString(record.subject),
      body,
      currentStatus,
      priorNotes: normalizeString(record.priorNotes),
      accountResolution:
        record.accountResolution && typeof record.accountResolution === 'object'
          ? {
              resolutionStatus: normalizeString(
                (record.accountResolution as Record<string, unknown>).resolutionStatus
              ) as 'resolved' | 'ambiguous' | 'unresolved' | 'manual_override',
              matchedContact:
                (record.accountResolution as Record<string, unknown>).matchedContact &&
                typeof (record.accountResolution as Record<string, unknown>).matchedContact ===
                  'object'
                  ? {
                      id: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .matchedContact as Record<string, unknown>
                        ).id
                      ),
                      name: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .matchedContact as Record<string, unknown>
                        ).name
                      ),
                      email: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .matchedContact as Record<string, unknown>
                        ).email
                      )
                    }
                  : null,
              account:
                (record.accountResolution as Record<string, unknown>).account &&
                typeof (record.accountResolution as Record<string, unknown>).account === 'object'
                  ? {
                      id: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .account as Record<string, unknown>
                        ).id
                      ),
                      name: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .account as Record<string, unknown>
                        ).name
                      )
                    }
                  : null,
              property:
                (record.accountResolution as Record<string, unknown>).property &&
                typeof (record.accountResolution as Record<string, unknown>).property ===
                  'object'
                  ? {
                      id: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .property as Record<string, unknown>
                        ).id
                      ),
                      name: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .property as Record<string, unknown>
                        ).name
                      )
                    }
                  : null,
              binder:
                (record.accountResolution as Record<string, unknown>).binder &&
                typeof (record.accountResolution as Record<string, unknown>).binder === 'object'
                  ? {
                      id: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .binder as Record<string, unknown>
                        ).id
                      ),
                      name: normalizeString(
                        (
                          (record.accountResolution as Record<string, unknown>)
                            .binder as Record<string, unknown>
                        ).name
                      )
                    }
                  : null,
              matchMethod: normalizeString(
                (record.accountResolution as Record<string, unknown>).matchMethod
              ) as 'exact_email' | 'property_or_binder_contact' | 'domain' | 'manual' | 'none',
              confidence: normalizeString(
                (record.accountResolution as Record<string, unknown>).confidence
              ) as 'high' | 'medium' | 'low',
              candidateMatches: Array.isArray(
                (record.accountResolution as Record<string, unknown>).candidateMatches
              )
                ? (
                    (record.accountResolution as Record<string, unknown>)
                      .candidateMatches as Array<Record<string, unknown>>
                  ).map((candidate) => ({
                    matchedContact:
                      candidate.matchedContact && typeof candidate.matchedContact === 'object'
                        ? {
                            id: normalizeString(
                              (candidate.matchedContact as Record<string, unknown>).id
                            ),
                            name: normalizeString(
                              (candidate.matchedContact as Record<string, unknown>).name
                            ),
                            email: normalizeString(
                              (candidate.matchedContact as Record<string, unknown>).email
                            )
                          }
                        : null,
                    account:
                      candidate.account && typeof candidate.account === 'object'
                        ? {
                            id: normalizeString(
                              (candidate.account as Record<string, unknown>).id
                            ),
                            name: normalizeString(
                              (candidate.account as Record<string, unknown>).name
                            )
                          }
                        : null,
                    property:
                      candidate.property && typeof candidate.property === 'object'
                        ? {
                            id: normalizeString(
                              (candidate.property as Record<string, unknown>).id
                            ),
                            name: normalizeString(
                              (candidate.property as Record<string, unknown>).name
                            )
                          }
                        : null,
                    binder:
                      candidate.binder && typeof candidate.binder === 'object'
                        ? {
                            id: normalizeString(
                              (candidate.binder as Record<string, unknown>).id
                            ),
                            name: normalizeString(
                              (candidate.binder as Record<string, unknown>).name
                            )
                          }
                        : null,
                    matchMethod: normalizeString(candidate.matchMethod) as
                      | 'exact_email'
                      | 'property_or_binder_contact'
                      | 'domain'
                      | 'manual'
                      | 'none',
                    confidence: normalizeString(candidate.confidence) as
                      | 'high'
                      | 'medium'
                      | 'low'
                  }))
                : [],
              resolvedBy: normalizeString(
                (record.accountResolution as Record<string, unknown>).resolvedBy
              ),
              resolvedAt: normalizeString(
                (record.accountResolution as Record<string, unknown>).resolvedAt
              )
            }
          : null,
    classification:
      record.classification && typeof record.classification === 'object'
        ? {
            issue_type: normalizeString(
              (record.classification as Record<string, unknown>).issue_type
            ),
            priority: normalizeString(
              (record.classification as Record<string, unknown>).priority
            ),
            sla_risk: normalizeString(
              (record.classification as Record<string, unknown>).sla_risk
            ),
            needs_human_review:
              (record.classification as Record<string, unknown>).needs_human_review ===
              true,
            recommended_next_step: normalizeString(
              (record.classification as Record<string, unknown>).recommended_next_step
            ),
            escalation_reason: normalizeString(
              (record.classification as Record<string, unknown>).escalation_reason
            )
          }
        : null,
    accountContextSummary:
      record.accountContextSummary && typeof record.accountContextSummary === 'object'
        ? {
            customer: normalizeString(
              (record.accountContextSummary as Record<string, unknown>).customer
            ),
            account_status: normalizeString(
              (record.accountContextSummary as Record<string, unknown>).account_status
            ),
            plan_or_tier: normalizeString(
              (record.accountContextSummary as Record<string, unknown>).plan_or_tier
            ),
            recent_activity_summary: normalizeString(
              (record.accountContextSummary as Record<string, unknown>)
                .recent_activity_summary
            ),
            relevant_documents_or_records: normalizeStringArray(
              (record.accountContextSummary as Record<string, unknown>)
                .relevant_documents_or_records
            ),
            risk_flags: normalizeStringArray(
              (record.accountContextSummary as Record<string, unknown>).risk_flags
            ),
            recommended_support_context: normalizeString(
              (record.accountContextSummary as Record<string, unknown>)
                .recommended_support_context
            )
          }
        : null,
    replyDraft:
      record.replyDraft && typeof record.replyDraft === 'object'
        ? {
            subject: normalizeString(
              (record.replyDraft as Record<string, unknown>).subject
            ),
            reply_body: normalizeString(
              (record.replyDraft as Record<string, unknown>).reply_body
            ),
            tone: normalizeString((record.replyDraft as Record<string, unknown>).tone),
            needs_human_review:
              (record.replyDraft as Record<string, unknown>).needs_human_review === true,
            follow_up_questions: normalizeStringArray(
              (record.replyDraft as Record<string, unknown>).follow_up_questions
            ),
            escalation_hint: normalizeString(
              (record.replyDraft as Record<string, unknown>).escalation_hint
            )
          }
        : null,
    escalation:
      record.escalation && typeof record.escalation === 'object'
        ? {
            escalation_title: normalizeString(
              (record.escalation as Record<string, unknown>).escalation_title
            ),
            escalation_summary: normalizeString(
              (record.escalation as Record<string, unknown>).escalation_summary
            ),
            severity: normalizeString(
              (record.escalation as Record<string, unknown>).severity
            ),
            recommended_owner: normalizeString(
              (record.escalation as Record<string, unknown>).recommended_owner
            ),
            blocking_unknowns: normalizeStringArray(
              (record.escalation as Record<string, unknown>).blocking_unknowns
            ),
            customer_impact: normalizeString(
              (record.escalation as Record<string, unknown>).customer_impact
            ),
            internal_next_step: normalizeString(
              (record.escalation as Record<string, unknown>).internal_next_step
            )
          }
        : null
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const detail = await getSupportTicketDetail(decodeURIComponent(ticketId));

    if (!detail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Support ticket not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      detail
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to load support ticket detail.'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const payload = await request.json().catch(() => null);
    const patch = normalizeDraftPatch(payload);

    if (!patch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid support draft payload'
        },
        { status: 400 }
      );
    }

    const detail = await saveSupportTicketDraft(decodeURIComponent(ticketId), patch);

    if (!detail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Support ticket not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      detail
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save support draft.'
      },
      { status: 500 }
    );
  }
}
