export const SUPPORT_CLASSIFICATION_FIELDS = [
  'issue_type',
  'priority',
  'sla_risk',
  'needs_human_review',
  'recommended_next_step',
  'escalation_reason'
] as const;

export const SUPPORT_ACCOUNT_CONTEXT_FIELDS = [
  'customer',
  'account_status',
  'plan_or_tier',
  'recent_activity_summary',
  'relevant_documents_or_records',
  'risk_flags',
  'recommended_support_context'
] as const;

export const SUPPORT_REPLY_DRAFT_FIELDS = [
  'subject',
  'reply_body',
  'tone',
  'needs_human_review',
  'follow_up_questions',
  'escalation_hint'
] as const;

export const SUPPORT_ESCALATION_FIELDS = [
  'escalation_title',
  'escalation_summary',
  'severity',
  'recommended_owner',
  'blocking_unknowns',
  'customer_impact',
  'internal_next_step'
] as const;

export type SupportClassificationField =
  (typeof SUPPORT_CLASSIFICATION_FIELDS)[number];

export type SupportAccountContextField =
  (typeof SUPPORT_ACCOUNT_CONTEXT_FIELDS)[number];

export type SupportReplyDraftField =
  (typeof SUPPORT_REPLY_DRAFT_FIELDS)[number];

export type SupportEscalationField =
  (typeof SUPPORT_ESCALATION_FIELDS)[number];

export const SUPPORT_ACCOUNT_RESOLUTION_STATUSES = [
  'resolved',
  'ambiguous',
  'unresolved',
  'manual_override'
] as const;

export const SUPPORT_ACCOUNT_RESOLUTION_METHODS = [
  'exact_email',
  'property_or_binder_contact',
  'domain',
  'manual',
  'none'
] as const;

export const SUPPORT_ACCOUNT_RESOLUTION_CONFIDENCE = [
  'high',
  'medium',
  'low'
] as const;

export type SupportAccountResolutionStatus =
  (typeof SUPPORT_ACCOUNT_RESOLUTION_STATUSES)[number];

export type SupportAccountResolutionMethod =
  (typeof SUPPORT_ACCOUNT_RESOLUTION_METHODS)[number];

export type SupportAccountResolutionConfidence =
  (typeof SUPPORT_ACCOUNT_RESOLUTION_CONFIDENCE)[number];

export type SupportResolvedEntityRef = {
  id: string;
  name: string;
};

export type SupportResolvedContact = SupportResolvedEntityRef & {
  email: string;
};

export type SupportAccountResolutionCandidate = {
  matchedContact: SupportResolvedContact | null;
  account: SupportResolvedEntityRef | null;
  property: SupportResolvedEntityRef | null;
  binder: SupportResolvedEntityRef | null;
  matchMethod: SupportAccountResolutionMethod;
  confidence: SupportAccountResolutionConfidence;
};

export type SupportAccountResolution = {
  resolutionStatus: SupportAccountResolutionStatus;
  matchedContact: SupportResolvedContact | null;
  account: SupportResolvedEntityRef | null;
  property: SupportResolvedEntityRef | null;
  binder: SupportResolvedEntityRef | null;
  matchMethod: SupportAccountResolutionMethod;
  confidence: SupportAccountResolutionConfidence;
  candidateMatches: SupportAccountResolutionCandidate[];
  resolvedBy: string;
  resolvedAt: string;
};

export type SupportTicketClassification = {
  issue_type: string;
  priority: string;
  sla_risk: string;
  needs_human_review: boolean;
  recommended_next_step: string;
  escalation_reason: string;
};

export type SupportTicketClassificationInput = {
  ticketId?: string;
  subject?: string;
  body: string;
  threadTranscript?: string;
  channel?: string;
  customerName?: string;
  accountId?: string;
  currentStatus?: string;
  priorNotes?: string;
};

export type SupportAccountContextSummary = {
  customer: string;
  account_status: string;
  plan_or_tier: string;
  recent_activity_summary: string;
  relevant_documents_or_records: string[];
  risk_flags: string[];
  recommended_support_context: string;
};

export type SupportAccountContextSummaryInput = {
  accountId?: string;
  customerName?: string;
  ticketId?: string;
  subject?: string;
  body?: string;
  threadTranscript?: string;
  currentStatus?: string;
  planOrTier?: string;
  priorNotes?: string;
  recentActivity?: string;
  relevantRecords?: string;
  accountSnapshot?: string;
};

export type SupportReplyDraft = {
  subject: string;
  reply_body: string;
  tone: string;
  needs_human_review: boolean;
  follow_up_questions: string[];
  escalation_hint: string;
};

export type SupportReplyDraftInput = {
  ticketId?: string;
  accountId?: string;
  customerName?: string;
  subject?: string;
  body: string;
  threadTranscript?: string;
  channel?: string;
  currentStatus?: string;
  priorNotes?: string;
  accountContextSummary?: string;
  internalGuidance?: string;
};

export type SupportEscalation = {
  escalation_title: string;
  escalation_summary: string;
  severity: string;
  recommended_owner: string;
  blocking_unknowns: string[];
  customer_impact: string;
  internal_next_step: string;
};

export type SupportEscalationInput = {
  ticketId?: string;
  accountId?: string;
  customerName?: string;
  subject?: string;
  body: string;
  threadTranscript?: string;
  currentStatus?: string;
  classificationSummary?: string;
  accountContextSummary?: string;
  draftReplySummary?: string;
  priorNotes?: string;
  internalGuidance?: string;
};
