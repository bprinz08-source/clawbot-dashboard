import { mkdir, readFile, writeFile } from 'fs/promises';
import {
  applyManualSupportAccountResolution,
  resolveSupportAccountByEmail
} from '@/lib/support-account-resolution';
import { getGmailSupportThread, listGmailSupportThreads } from '@/lib/support-gmail';
import {
  type SupportQueueItem,
  type SupportTicketDraft,
  type SupportStatus,
  type SupportTicketDetail,
  type SupportTicketDraftPatch,
  type SupportTicketRecord
} from '@/lib/support-operator-shared';
import type { SupportAccountResolutionCandidate } from '@/lib/support-shared';

const SUPPORT_DRAFTS_FILE =
  '/home/gtm-employee/workspaces/asbuilt-support/artifacts/operator-drafts.json';

function isSupportStatus(value: string): value is SupportStatus {
  return (
    value === 'open' ||
    value === 'waiting' ||
    value === 'needs_review' ||
    value === 'escalated' ||
    value === 'closed'
  );
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

function normalizeEntityRef(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeString(record.id);
  const name = normalizeString(record.name);

  if (!id && !name) {
    return null;
  }

  return { id, name };
}

function normalizeContactRef(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeString(record.id);
  const name = normalizeString(record.name);
  const email = normalizeString(record.email);

  if (!id && !name && !email) {
    return null;
  }

  return { id, name, email };
}

function normalizeAccountResolution(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    resolutionStatus: normalizeString(record.resolutionStatus) as
      | 'resolved'
      | 'ambiguous'
      | 'unresolved'
      | 'manual_override',
    matchedContact: normalizeContactRef(record.matchedContact),
    account: normalizeEntityRef(record.account),
    property: normalizeEntityRef(record.property),
    binder: normalizeEntityRef(record.binder),
    matchMethod: normalizeString(record.matchMethod) as
      | 'exact_email'
      | 'property_or_binder_contact'
      | 'domain'
      | 'manual'
      | 'none',
    confidence: normalizeString(record.confidence) as 'high' | 'medium' | 'low',
    candidateMatches: Array.isArray(record.candidateMatches)
      ? record.candidateMatches
          .map((entry) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }

            const candidate = entry as Record<string, unknown>;

            return {
              matchedContact: normalizeContactRef(candidate.matchedContact),
              account: normalizeEntityRef(candidate.account),
              property: normalizeEntityRef(candidate.property),
              binder: normalizeEntityRef(candidate.binder),
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
            } satisfies SupportAccountResolutionCandidate;
          })
          .filter(
            (candidate): candidate is SupportAccountResolutionCandidate => candidate !== null
          )
      : [],
    resolvedBy: normalizeString(record.resolvedBy),
    resolvedAt: normalizeString(record.resolvedAt)
  };
}

function normalizeDraftRecord(ticketId: string, rawValue: unknown): SupportTicketDraft | null {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const record = rawValue as Record<string, unknown>;
  const currentStatus = normalizeString(record.currentStatus);

  return {
    ticketId,
    customerName: normalizeString(record.customerName),
    accountId: normalizeString(record.accountId),
    propertyId: normalizeString(record.propertyId),
    binderId: normalizeString(record.binderId),
    resolvedContactId: normalizeString(record.resolvedContactId),
    subject: normalizeString(record.subject),
    body: normalizeString(record.body),
    currentStatus: isSupportStatus(currentStatus) ? currentStatus : 'open',
    priorNotes: normalizeString(record.priorNotes),
    accountResolution: normalizeAccountResolution(record.accountResolution),
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
        : null,
    savedAt: normalizeString(record.savedAt)
  };
}

async function readDraftMap() {
  try {
    const rawFile = await readFile(SUPPORT_DRAFTS_FILE, 'utf8');
    const parsed = JSON.parse(rawFile) as Record<string, unknown>;
    const nextMap = new Map<string, SupportTicketDraft>();

    for (const [ticketId, value] of Object.entries(parsed)) {
      const normalizedRecord = normalizeDraftRecord(ticketId, value);

      if (normalizedRecord) {
        nextMap.set(ticketId, normalizedRecord);
      }
    }

    return nextMap;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOENT') {
      return new Map<string, SupportTicketDraft>();
    }

    throw error;
  }
}

async function writeDraftMap(drafts: Map<string, SupportTicketDraft>) {
  await mkdir('/home/gtm-employee/workspaces/asbuilt-support/artifacts', {
    recursive: true
  });

  const serialized = Object.fromEntries(drafts.entries());

  await writeFile(SUPPORT_DRAFTS_FILE, JSON.stringify(serialized, null, 2));
}

function buildQueueItem(ticket: SupportTicketRecord, draft: SupportTicketDraft | null): SupportQueueItem {
  const currentStatus = draft?.currentStatus || ticket.currentStatus;
  const needsHumanReview =
    draft?.classification?.needs_human_review === true ||
    draft?.replyDraft?.needs_human_review === true;

  return {
    ticketId: ticket.ticketId,
    customerName: draft?.customerName || ticket.customerName,
    customerEmail: ticket.customerEmail,
    subject: draft?.subject || ticket.subject,
    channel: ticket.channel,
    currentStatus,
    lastUpdatedAt: draft?.savedAt || ticket.lastUpdatedAt,
    needsHumanReview,
    hasDraftReply: Boolean(draft?.replyDraft),
    hasEscalationDraft: Boolean(draft?.escalation)
  };
}

function mapGmailThreadToTicketRecord(thread: Awaited<ReturnType<typeof getGmailSupportThread>>): SupportTicketRecord | null {
  if (!thread) {
    return null;
  }

  return {
    ticketId: thread.threadId,
    customerName: thread.customerName,
    customerEmail: thread.customerEmail,
    accountId: '',
    subject: thread.subject,
    body: thread.body,
    channel: thread.channel,
    currentStatus: 'open',
    lastUpdatedAt: thread.lastUpdatedAt
  };
}

export async function listSupportQueueItems() {
  const drafts = await readDraftMap();
  const threads = await listGmailSupportThreads();

  return threads
    .map((thread) => {
      const ticket = mapGmailThreadToTicketRecord(thread);

      if (!ticket) {
        return null;
      }

      return buildQueueItem(ticket, drafts.get(ticket.ticketId) || null);
    })
    .filter((ticket): ticket is SupportQueueItem => Boolean(ticket))
    .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));
}

export async function getSupportTicketDetail(ticketId: string): Promise<SupportTicketDetail | null> {
  const thread = await getGmailSupportThread(ticketId);
  const ticket = mapGmailThreadToTicketRecord(thread);

  if (!thread || !ticket) {
    return null;
  }

  const drafts = await readDraftMap();
  const draft = drafts.get(ticketId) || null;
  const resolvedFromEmail = await resolveSupportAccountByEmail(ticket.customerEmail);
  const manualResolution = draft?.accountResolution
    ? applyManualSupportAccountResolution({
        existingResolution: draft.accountResolution,
        resolvedContactId: draft.resolvedContactId,
        matchedContactName: draft.accountResolution.matchedContact?.name || '',
        matchedContactEmail: draft.accountResolution.matchedContact?.email || '',
        accountId: draft.accountId,
        accountName: draft.accountResolution.account?.name || '',
        propertyId: draft.propertyId,
        propertyName: draft.accountResolution.property?.name || '',
        binderId: draft.binderId,
        binderName: draft.accountResolution.binder?.name || ''
      })
    : null;
  const accountResolution = manualResolution || draft?.accountResolution || resolvedFromEmail;

  return {
    ticket,
    draft,
    accountResolution,
    messages: thread.messages.map((message) => ({
      id: message.id,
      fromName: message.fromName,
      fromEmail: message.fromEmail,
      to: message.to,
      subject: message.subject,
      sentAt: message.sentAt,
      body: message.body,
      isInbound: message.isInbound
    })),
    transcript: thread.transcript
  };
}

export async function saveSupportTicketDraft(
  ticketId: string,
  patch: SupportTicketDraftPatch
): Promise<SupportTicketDetail | null> {
  const detail = await getSupportTicketDetail(ticketId);

  if (!detail) {
    return null;
  }

  const drafts = await readDraftMap();
  const savedAt = new Date().toISOString();
  const patchAccountResolution = patch.accountResolution;
  const manualResolution = applyManualSupportAccountResolution({
    existingResolution: detail.accountResolution,
    resolvedContactId: patch.resolvedContactId,
    matchedContactName:
      patchAccountResolution?.matchedContact?.name ||
      detail.accountResolution.matchedContact?.name ||
      '',
    matchedContactEmail:
      patchAccountResolution?.matchedContact?.email ||
      detail.accountResolution.matchedContact?.email ||
      '',
    accountId: patch.accountId,
    accountName:
      patchAccountResolution?.account?.name || detail.accountResolution.account?.name || '',
    propertyId: patch.propertyId,
    propertyName:
      patchAccountResolution?.property?.name || detail.accountResolution.property?.name || '',
    binderId: patch.binderId,
    binderName:
      patchAccountResolution?.binder?.name || detail.accountResolution.binder?.name || ''
  });

  drafts.set(ticketId, {
    ticketId,
    customerName: patch.customerName,
    accountId: patch.accountId,
    propertyId: patch.propertyId,
    binderId: patch.binderId,
    resolvedContactId: patch.resolvedContactId,
    subject: patch.subject,
    body: patch.body,
    currentStatus: patch.currentStatus,
    priorNotes: patch.priorNotes,
    accountResolution: patchAccountResolution || manualResolution,
    classification: patch.classification,
    accountContextSummary: patch.accountContextSummary,
    replyDraft: patch.replyDraft,
    escalation: patch.escalation,
    savedAt
  });

  await writeDraftMap(drafts);

  return {
    ...detail,
    draft: drafts.get(ticketId) || null,
    accountResolution:
      drafts.get(ticketId)?.accountResolution || detail.accountResolution
  };
}
