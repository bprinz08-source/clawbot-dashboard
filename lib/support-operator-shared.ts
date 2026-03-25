import type {
  SupportAccountContextSummary,
  SupportAccountResolution,
  SupportEscalation,
  SupportReplyDraft,
  SupportTicketClassification
} from '@/lib/support-shared';

export const SUPPORT_STATUSES = [
  'open',
  'waiting',
  'needs_review',
  'escalated',
  'closed'
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export type SupportTicketRecord = {
  ticketId: string;
  customerName: string;
  customerEmail: string;
  accountId: string;
  subject: string;
  body: string;
  channel: string;
  currentStatus: SupportStatus;
  lastUpdatedAt: string;
};

export type SupportThreadMessage = {
  id: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  sentAt: string;
  body: string;
  isInbound: boolean;
};

export type SupportTicketDraft = {
  ticketId: string;
  customerName: string;
  accountId: string;
  propertyId: string;
  binderId: string;
  resolvedContactId: string;
  subject: string;
  body: string;
  currentStatus: SupportStatus;
  priorNotes: string;
  accountResolution: SupportAccountResolution | null;
  classification: SupportTicketClassification | null;
  accountContextSummary: SupportAccountContextSummary | null;
  replyDraft: SupportReplyDraft | null;
  escalation: SupportEscalation | null;
  savedAt: string;
};

export type SupportQueueItem = {
  ticketId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  channel: string;
  currentStatus: SupportStatus;
  lastUpdatedAt: string;
  needsHumanReview: boolean;
  hasDraftReply: boolean;
  hasEscalationDraft: boolean;
};

export type SupportTicketDetail = {
  ticket: SupportTicketRecord;
  draft: SupportTicketDraft | null;
  accountResolution: SupportAccountResolution;
  messages: SupportThreadMessage[];
  transcript: string;
};

export type SupportTicketDraftPatch = {
  customerName: string;
  accountId: string;
  propertyId: string;
  binderId: string;
  resolvedContactId: string;
  subject: string;
  body: string;
  currentStatus: SupportStatus;
  priorNotes: string;
  accountResolution: SupportAccountResolution | null;
  classification: SupportTicketClassification | null;
  accountContextSummary: SupportAccountContextSummary | null;
  replyDraft: SupportReplyDraft | null;
  escalation: SupportEscalation | null;
};
