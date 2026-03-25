import { executeOpenClawAction } from '@/lib/openclaw';
import {
  SUPPORT_ACCOUNT_CONTEXT_FIELDS,
  SUPPORT_CLASSIFICATION_FIELDS,
  SUPPORT_ESCALATION_FIELDS,
  SUPPORT_REPLY_DRAFT_FIELDS,
  type SupportAccountContextField,
  type SupportAccountContextSummary,
  type SupportAccountContextSummaryInput,
  type SupportEscalation,
  type SupportEscalationField,
  type SupportEscalationInput,
  type SupportClassificationField,
  type SupportReplyDraft,
  type SupportReplyDraftField,
  type SupportReplyDraftInput,
  type SupportTicketClassification,
  type SupportTicketClassificationInput
} from '@/lib/support-shared';

function extractJsonObject(rawOutput: string, emptyMessage: string) {
  const trimmed = rawOutput.trim();

  if (!trimmed) {
    throw new Error(emptyMessage);
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('OpenClaw did not return valid JSON.');
  }

  return jsonMatch[0];
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return false;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function normalizeSupportClassification(rawResult: unknown): SupportTicketClassification {
  if (!rawResult || typeof rawResult !== 'object') {
    throw new Error('OpenClaw returned malformed support classification JSON.');
  }

  const record = rawResult as Partial<Record<SupportClassificationField, unknown>>;

  return {
    issue_type: normalizeString(record.issue_type),
    priority: normalizeString(record.priority),
    sla_risk: normalizeString(record.sla_risk),
    needs_human_review: normalizeBoolean(record.needs_human_review),
    recommended_next_step: normalizeString(record.recommended_next_step),
    escalation_reason: normalizeString(record.escalation_reason)
  };
}

function normalizeSupportAccountContext(rawResult: unknown): SupportAccountContextSummary {
  if (!rawResult || typeof rawResult !== 'object') {
    throw new Error('OpenClaw returned malformed support account context JSON.');
  }

  const record = rawResult as Partial<Record<SupportAccountContextField, unknown>>;

  return {
    customer: normalizeString(record.customer),
    account_status: normalizeString(record.account_status),
    plan_or_tier: normalizeString(record.plan_or_tier),
    recent_activity_summary: normalizeString(record.recent_activity_summary),
    relevant_documents_or_records: normalizeStringArray(
      record.relevant_documents_or_records
    ),
    risk_flags: normalizeStringArray(record.risk_flags),
    recommended_support_context: normalizeString(record.recommended_support_context)
  };
}

function normalizeSupportReplyDraft(rawResult: unknown): SupportReplyDraft {
  if (!rawResult || typeof rawResult !== 'object') {
    throw new Error('OpenClaw returned malformed support reply draft JSON.');
  }

  const record = rawResult as Partial<Record<SupportReplyDraftField, unknown>>;

  return {
    subject: normalizeString(record.subject),
    reply_body: normalizeString(record.reply_body),
    tone: normalizeString(record.tone),
    needs_human_review: normalizeBoolean(record.needs_human_review),
    follow_up_questions: normalizeStringArray(record.follow_up_questions),
    escalation_hint: normalizeString(record.escalation_hint)
  };
}

function normalizeSupportEscalation(rawResult: unknown): SupportEscalation {
  if (!rawResult || typeof rawResult !== 'object') {
    throw new Error('OpenClaw returned malformed support escalation JSON.');
  }

  const record = rawResult as Partial<Record<SupportEscalationField, unknown>>;

  return {
    escalation_title: normalizeString(record.escalation_title),
    escalation_summary: normalizeString(record.escalation_summary),
    severity: normalizeString(record.severity),
    recommended_owner: normalizeString(record.recommended_owner),
    blocking_unknowns: normalizeStringArray(record.blocking_unknowns),
    customer_impact: normalizeString(record.customer_impact),
    internal_next_step: normalizeString(record.internal_next_step)
  };
}

export async function classifySupportTicket(
  input: SupportTicketClassificationInput
) {
  const execution = await executeOpenClawAction({
    workspaceId: 'asbuilt_support',
    actionId: 'classify_ticket',
    payload: {
      objective:
        'Classify an inbound support ticket for internal operator triage only.',
      outputRequirements: [
        'Return ONLY valid JSON.',
        `Use exactly these keys: ${SUPPORT_CLASSIFICATION_FIELDS.join(', ')}.`,
        'Keep recommended_next_step concise and operator-facing.',
        'Set needs_human_review to a boolean.',
        'These outputs are draft-only and internal-only.'
      ],
      escalationRules: [
        'Mark needs_human_review true for billing/refund risk, legal/compliance/privacy issues, abusive or safety-sensitive content, missing account identity, or conflicting account data.'
      ],
      ticket: input
    }
  });

  const rawJson = extractJsonObject(
    execution.stdout,
    'OpenClaw returned an empty support classification.'
  );

  try {
    return {
      classification: normalizeSupportClassification(JSON.parse(rawJson)),
      execution
    };
  } catch (error) {
    const stderrMessage = execution.stderr.trim();

    if (stderrMessage) {
      throw new Error(stderrMessage);
    }

    throw error;
  }
}

export async function summarizeSupportAccountContext(
  input: SupportAccountContextSummaryInput
) {
  const execution = await executeOpenClawAction({
    workspaceId: 'asbuilt_support',
    actionId: 'summarize_account_context',
    payload: {
      objective:
        'Summarize customer account context for an internal support operator only.',
      outputRequirements: [
        'Return ONLY valid JSON.',
        `Use exactly these keys: ${SUPPORT_ACCOUNT_CONTEXT_FIELDS.join(', ')}.`,
        'Use strings for narrative fields.',
        'Use arrays of strings for relevant_documents_or_records and risk_flags.',
        'If data is missing, return an empty string or empty array instead of guessing.',
        'Keep outputs internal-only. Do not draft emails or external customer messages.'
      ],
      accountContext: input
    }
  });

  const rawJson = extractJsonObject(
    execution.stdout,
    'OpenClaw returned an empty support account context summary.'
  );

  try {
    return {
      summary: normalizeSupportAccountContext(JSON.parse(rawJson)),
      execution
    };
  } catch (error) {
    const stderrMessage = execution.stderr.trim();

    if (stderrMessage) {
      throw new Error(stderrMessage);
    }

    throw error;
  }
}

export async function draftSupportReply(
  input: SupportReplyDraftInput
) {
  const execution = await executeOpenClawAction({
    workspaceId: 'asbuilt_support',
    actionId: 'draft_support_reply',
    payload: {
      objective:
        'Draft an internal-only support reply for operator review before any external sending.',
      outputRequirements: [
        'Return ONLY valid JSON.',
        `Use exactly these keys: ${SUPPORT_REPLY_DRAFT_FIELDS.join(', ')}.`,
        'Set needs_human_review to a boolean.',
        'Use an array of strings for follow_up_questions.',
        'Keep the draft concise, support-appropriate, and grounded only in the provided context.',
        'Keep outputs draft-only and internal-only. Do not send emails or external messages.'
      ],
      reviewRules: [
        'Set needs_human_review true when the request involves refunds, billing disputes, legal/compliance/privacy issues, security concerns, account ownership uncertainty, or missing facts required for a safe response.'
      ],
      replyContext: input
    }
  });

  const rawJson = extractJsonObject(
    execution.stdout,
    'OpenClaw returned an empty support reply draft.'
  );

  try {
    return {
      draft: normalizeSupportReplyDraft(JSON.parse(rawJson)),
      execution
    };
  } catch (error) {
    const stderrMessage = execution.stderr.trim();

    if (stderrMessage) {
      throw new Error(stderrMessage);
    }

    throw error;
  }
}

export async function prepareSupportEscalation(
  input: SupportEscalationInput
) {
  const execution = await executeOpenClawAction({
    workspaceId: 'asbuilt_support',
    actionId: 'prepare_escalation',
    payload: {
      objective:
        'Prepare an internal-only support escalation artifact for operator handoff.',
      outputRequirements: [
        'Return ONLY valid JSON.',
        `Use exactly these keys: ${SUPPORT_ESCALATION_FIELDS.join(', ')}.`,
        'Use an array of strings for blocking_unknowns.',
        'Keep the output concise, operator-facing, and grounded only in the provided context.',
        'Keep outputs internal-only. Do not send emails or external messages.'
      ],
      escalationGuidance: [
        'Call out the operational impact on the customer clearly.',
        'List unresolved facts in blocking_unknowns instead of guessing.',
        'Recommend the most appropriate owner based on the issue described.'
      ],
      escalationContext: input
    }
  });

  const rawJson = extractJsonObject(
    execution.stdout,
    'OpenClaw returned an empty support escalation.'
  );

  try {
    return {
      escalation: normalizeSupportEscalation(JSON.parse(rawJson)),
      execution
    };
  } catch (error) {
    const stderrMessage = execution.stderr.trim();

    if (stderrMessage) {
      throw new Error(stderrMessage);
    }

    throw error;
  }
}
