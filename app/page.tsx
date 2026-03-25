'use client';

import dynamic from 'next/dynamic';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { BuilderRecord } from '@/lib/builder-schema';
import { AI_DRAFT_FIELDS, type AiDraftField } from '@/lib/builder-ai-shared';
import {
  RECOMMENDED_CONTACT_FIELDS,
  type RecommendedContactField
} from '@/lib/builder-contact-shared';
import {
  SUPPORT_STATUSES,
  type SupportQueueItem,
  type SupportStatus,
  type SupportTicketDetail,
  type SupportTicketDraftPatch
} from '@/lib/support-operator-shared';
import type {
  SupportAccountContextSummary,
  SupportAccountResolution,
  SupportAccountResolutionCandidate,
  SupportEscalation,
  SupportReplyDraft,
  SupportTicketClassification
} from '@/lib/support-shared';
import {
  JOB_HUNT_LANES,
  JOB_HUNT_STATUSES,
  type JobHuntLane,
  type JobHuntRole,
  type JobHuntStatus
} from '@/lib/job-hunt-shared';

type WorkspaceView = 'builders' | 'support' | 'job-hunt';

type BuildersResponse = {
  success: boolean;
  error?: string;
  source?: string;
  rows?: BuilderRecord[];
};

type BuilderDetailResponse = {
  success: boolean;
  error?: string;
  builder?: BuilderRecord;
};

type BuilderDraftResponse = {
  success: boolean;
  error?: string;
  draftField?: AiDraftField;
  generatedText?: string;
  builder?: BuilderRecord;
};

type BuilderContactResponse = {
  success: boolean;
  error?: string;
  builder?: BuilderRecord;
};

type SupportQueueResponse = {
  success: boolean;
  error?: string;
  tickets?: SupportQueueItem[];
};

type SupportDetailResponse = {
  success: boolean;
  error?: string;
  detail?: SupportTicketDetail;
};

type SupportClassifyResponse = {
  success: boolean;
  error?: string;
  classification?: SupportTicketClassification;
};

type SupportSummaryResponse = {
  success: boolean;
  error?: string;
  summary?: SupportAccountContextSummary;
};

type SupportReplyResponse = {
  success: boolean;
  error?: string;
  draft?: SupportReplyDraft;
};

type SupportEscalationResponse = {
  success: boolean;
  error?: string;
  escalation?: SupportEscalation;
};

type JobHuntQueueResponse = {
  success: boolean;
  error?: string;
  opportunities?: JobHuntRole[];
  source?: string;
};

type JobHuntDetailResponse = {
  success: boolean;
  error?: string;
  opportunity?: JobHuntRole;
};

type SupportEditorState = SupportTicketDraftPatch;

type SupportActionId =
  | 'classify_ticket'
  | 'summarize_account_context'
  | 'draft_support_reply'
  | 'prepare_escalation';

type JobHuntFilterValue = 'all' | JobHuntStatus;
type JobHuntLaneFilterValue = 'all' | JobHuntLane;
type JobHuntEditorState = JobHuntRole;

const TABLE_COLUMNS: Array<{
  key: keyof BuilderRecord;
  label: string;
}> = [
  { key: 'company_name', label: 'Company' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'builder_type', label: 'Builder Type' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'tier', label: 'Tier' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' }
];

const DETAIL_FIELDS: Array<{
  key: keyof BuilderRecord;
  label: string;
  type?: 'text' | 'date' | 'textarea' | 'url' | 'email';
}> = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'website', label: 'Website' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'builder_type', label: 'Builder Type' },
  { key: 'contact_name', label: 'Contact Name' },
  { key: 'contact_title', label: 'Contact Title' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
  { key: 'tier', label: 'Tier' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'last_contact_date', label: 'Last Contact Date', type: 'date' },
  { key: 'next_action', label: 'Next Action' },
  { key: 'next_action_due', label: 'Next Action Due', type: 'date' },
  { key: 'owner', label: 'Owner' },
  { key: 'recommended_contact_name', label: 'Recommended Contact Name' },
  { key: 'recommended_contact_title', label: 'Recommended Contact Title' },
  { key: 'recommended_contact_url', label: 'Recommended Contact URL' },
  {
    key: 'recommended_contact_linkedin_url',
    label: 'Recommended Contact LinkedIn URL'
  },
  {
    key: 'recommended_contact_confidence',
    label: 'Recommended Contact Confidence'
  },
  {
    key: 'recommended_contact_summary',
    label: 'Recommended Contact Summary',
    type: 'textarea'
  },
  { key: 'call_path_hint', label: 'Call Path Hint', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'call_talk_track', label: 'Call Talk Track', type: 'textarea' },
  { key: 'followup_email_draft', label: 'Follow-up Email Draft', type: 'textarea' },
  { key: 'linkedin_connect_draft', label: 'LinkedIn Connection Message', type: 'textarea' }
];

const AI_ACTIONS: Array<{
  draftField: AiDraftField;
  label: string;
}> = [
  { draftField: 'call_talk_track', label: 'Generate call talk track' },
  { draftField: 'followup_email_draft', label: 'Generate follow-up email' },
  {
    draftField: 'linkedin_connect_draft',
    label: 'Generate LinkedIn connection message'
  }
];

const SUPPORT_ACTIONS: Array<{
  id: SupportActionId;
  label: string;
}> = [
  { id: 'classify_ticket', label: 'Classify ticket' },
  { id: 'summarize_account_context', label: 'Summarize account context' },
  { id: 'draft_support_reply', label: 'Draft support reply' },
  { id: 'prepare_escalation', label: 'Prepare escalation' }
];

const JOB_HUNT_ACTIVE_PIPELINE_STATUSES: JobHuntStatus[] = [
  'Qualified',
  'Ready to apply',
  'Applied',
  'Follow-up due',
  'Recruiter conversation',
  'Interviewing',
  'Offer'
];

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase();
}

function createEmptyFormState() {
  return DETAIL_FIELDS.reduce((formState, field) => {
    formState[field.key] = '';
    return formState;
  }, {} as Partial<BuilderRecord>);
}

function createEmptyDraftMessages() {
  return AI_DRAFT_FIELDS.reduce((messages, field) => {
    messages[field] = '';
    return messages;
  }, {} as Record<AiDraftField, string>);
}

function createSupportActionMessages() {
  return SUPPORT_ACTIONS.reduce((messages, action) => {
    messages[action.id] = '';
    return messages;
  }, {} as Record<SupportActionId, string>);
}

function createJobHuntEditorState(role?: JobHuntRole | null): JobHuntEditorState {
  if (role) {
    return { ...role };
  }

  return {
    opportunity_id: '',
    lane: 'Enterprise AE / Strategic AE',
    company_name: '',
    role_title: '',
    location: '',
    work_model: '',
    compensation_estimate: '',
    source: '',
    posting_url: '',
    date_found: '',
    status: 'New',
    fit_score: 0,
    story_match_score: 0,
    urgency_score: 0,
    why_this_role: '',
    why_brandon_wins_here: '',
    narrative_angle: '',
    resume_version: '',
    follow_up_date: '',
    notes: '',
    created_at: '',
    updated_at: ''
  };
}

function createEmptySupportEditorState(): SupportEditorState {
  return {
    customerName: '',
    accountId: '',
    propertyId: '',
    binderId: '',
    resolvedContactId: '',
    subject: '',
    body: '',
    currentStatus: 'open',
    priorNotes: '',
    accountResolution: null,
    classification: null,
    accountContextSummary: null,
    replyDraft: null,
    escalation: null
  };
}

function createSupportEditorStateFromDetail(detail: SupportTicketDetail): SupportEditorState {
  if (!detail.draft) {
    return {
      customerName: detail.ticket.customerName,
      accountId: detail.accountResolution.account?.id || detail.ticket.accountId,
      propertyId: detail.accountResolution.property?.id || '',
      binderId: detail.accountResolution.binder?.id || '',
      resolvedContactId: detail.accountResolution.matchedContact?.id || '',
      subject: detail.ticket.subject,
      body: detail.ticket.body,
      currentStatus: detail.ticket.currentStatus,
      priorNotes: '',
      accountResolution: detail.accountResolution,
      classification: null,
      accountContextSummary: null,
      replyDraft: null,
      escalation: null
    };
  }

  return {
    customerName: detail.draft.customerName || detail.ticket.customerName,
    accountId:
      detail.draft.accountId ||
      detail.accountResolution.account?.id ||
      detail.ticket.accountId,
    propertyId: detail.draft.propertyId || detail.accountResolution.property?.id || '',
    binderId: detail.draft.binderId || detail.accountResolution.binder?.id || '',
    resolvedContactId:
      detail.draft.resolvedContactId || detail.accountResolution.matchedContact?.id || '',
    subject: detail.draft.subject || detail.ticket.subject,
    body: detail.draft.body || detail.ticket.body,
    currentStatus: detail.draft.currentStatus,
    priorNotes: detail.draft.priorNotes,
    accountResolution: detail.draft.accountResolution || detail.accountResolution,
    classification: detail.draft.classification,
    accountContextSummary: detail.draft.accountContextSummary,
    replyDraft: detail.draft.replyDraft,
    escalation: detail.draft.escalation
  };
}

function isAiDraftField(field: keyof BuilderRecord): field is AiDraftField {
  return AI_DRAFT_FIELDS.includes(field as AiDraftField);
}

function isRecommendedContactField(
  field: keyof BuilderRecord
): field is RecommendedContactField {
  return RECOMMENDED_CONTACT_FIELDS.includes(field as RecommendedContactField);
}

function joinList(values: string[]) {
  return values.join('\n');
}

function splitList(value: string) {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatTimestamp(value: string) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatDateLabel(value: string) {
  if (!value) {
    return '—';
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${month}/${day}/${year}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function scoreJobRole(role: JobHuntRole) {
  return role.story_match_score * 0.45 + role.fit_score * 0.35 + role.urgency_score * 0.2;
}

function getTodayQueueReason(role: JobHuntRole, today: string) {
  if (role.follow_up_date && role.follow_up_date <= today) {
    return role.follow_up_date === today ? 'Follow-up due today' : 'Overdue follow-up';
  }

  if (role.status === 'Ready to apply') {
    return 'Ready for application package review';
  }

  if (role.story_match_score >= 92) {
    return 'Very strong story-match';
  }

  return 'Needs a clear next step';
}

function getJobRoleStatusTone(status: JobHuntStatus) {
  if (status === 'Offer') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300';
  }

  if (status === 'Follow-up due' || status === 'Interviewing') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300';
  }

  if (status === 'Rejected' || status === 'Not a fit' || status === 'Archived') {
    return 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300';
  }

  return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300';
}

function buildSupportQueuePreview(
  ticket: SupportQueueItem,
  state: SupportEditorState
): SupportQueueItem {
  return {
    ...ticket,
    customerName: state.customerName || ticket.customerName,
    subject: state.subject || ticket.subject,
    currentStatus: state.currentStatus,
    needsHumanReview:
      state.classification?.needs_human_review === true ||
      state.replyDraft?.needs_human_review === true,
    hasDraftReply: Boolean(state.replyDraft),
    hasEscalationDraft: Boolean(state.escalation)
  };
}

function summarizeClassification(classification: SupportTicketClassification | null) {
  if (!classification) {
    return '';
  }

  return [
    `Issue type: ${classification.issue_type}`,
    `Priority: ${classification.priority}`,
    `SLA risk: ${classification.sla_risk}`,
    `Needs human review: ${classification.needs_human_review ? 'true' : 'false'}`,
    `Recommended next step: ${classification.recommended_next_step}`,
    `Escalation reason: ${classification.escalation_reason}`
  ]
    .filter((line) => !line.endsWith(': '))
    .join('\n');
}

function summarizeAccountContext(summary: SupportAccountContextSummary | null) {
  if (!summary) {
    return '';
  }

  return [
    `Customer: ${summary.customer}`,
    `Account status: ${summary.account_status}`,
    `Plan or tier: ${summary.plan_or_tier}`,
    `Recent activity: ${summary.recent_activity_summary}`,
    `Relevant records: ${summary.relevant_documents_or_records.join(', ')}`,
    `Risk flags: ${summary.risk_flags.join(', ')}`,
    `Recommended support context: ${summary.recommended_support_context}`
  ]
    .filter((line) => !line.endsWith(': '))
    .join('\n');
}

function summarizeResolutionCandidate(candidate: SupportAccountResolution['candidateMatches'][number]) {
  return [
    candidate.matchedContact?.email || candidate.matchedContact?.name || '',
    candidate.account?.name || candidate.account?.id || '',
    candidate.property?.name || candidate.property?.id || '',
    candidate.binder?.name || candidate.binder?.id || ''
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildManualResolutionFromCandidate(
  candidate: SupportAccountResolutionCandidate,
  existingResolution: SupportAccountResolution | null
): SupportAccountResolution {
  return {
    resolutionStatus: 'manual_override',
    matchedContact: candidate.matchedContact,
    account: candidate.account,
    property: candidate.property,
    binder: candidate.binder,
    matchMethod: 'manual',
    confidence: candidate.confidence,
    candidateMatches: existingResolution?.candidateMatches || [],
    resolvedBy: 'operator',
    resolvedAt: new Date().toISOString()
  };
}

function buildSupportActionLogContext(state: SupportEditorState) {
  return {
    resolutionStatus: state.accountResolution?.resolutionStatus || 'unresolved',
    resolvedAccountId: state.accountId,
    resolvedPropertyId: state.propertyId,
    resolvedBinderId: state.binderId,
    needsHumanReview:
      state.classification?.needs_human_review === true ||
      state.replyDraft?.needs_human_review === true,
    operatorSource: 'support_dashboard'
  };
}

function summarizeReplyDraft(draft: SupportReplyDraft | null) {
  if (!draft) {
    return '';
  }

  return [
    `Subject: ${draft.subject}`,
    `Reply body: ${draft.reply_body}`,
    `Tone: ${draft.tone}`,
    `Needs human review: ${draft.needs_human_review ? 'true' : 'false'}`,
    `Follow-up questions: ${draft.follow_up_questions.join(', ')}`,
    `Escalation hint: ${draft.escalation_hint}`
  ]
    .filter((line) => !line.endsWith(': '))
    .join('\n');
}

const BuilderFilters = dynamic(() => import('./builder-filters'), {
  ssr: false,
  loading: () => (
    <>
      <div className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Search</span>
        <div className="h-10 rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900" />
      </div>

      <div className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Tier</span>
        <div className="h-10 rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900" />
      </div>
    </>
  )
});

const SupportFilters = dynamic(() => import('./support-filters'), {
  ssr: false,
  loading: () => (
    <>
      <div className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Search</span>
        <div className="h-10 rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900" />
      </div>

      <div className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Status</span>
        <div className="h-10 rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900" />
      </div>
    </>
  )
});

export default function HomePage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>('builders');

  const [builders, setBuilders] = useState<BuilderRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedBuilder, setSelectedBuilder] = useState<BuilderRecord | null>(null);
  const [formState, setFormState] = useState<Partial<BuilderRecord>>(createEmptyFormState);
  const [detailError, setDetailError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDraftField, setActiveDraftField] = useState<AiDraftField | null>(null);
  const [draftErrors, setDraftErrors] =
    useState<Record<AiDraftField, string>>(createEmptyDraftMessages);
  const [draftSuccesses, setDraftSuccesses] =
    useState<Record<AiDraftField, string>>(createEmptyDraftMessages);
  const [isFindingContact, setIsFindingContact] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState('');

  const [supportTickets, setSupportTickets] = useState<SupportQueueItem[]>([]);
  const [supportSearchTerm, setSupportSearchTerm] = useState('');
  const [supportStatusFilter, setSupportStatusFilter] = useState<'all' | SupportStatus>('all');
  const [supportError, setSupportError] = useState('');
  const [supportLoadError, setSupportLoadError] = useState('');
  const [supportSaveError, setSupportSaveError] = useState('');
  const [supportSaveSuccess, setSupportSaveSuccess] = useState('');
  const [isSupportQueueLoading, setIsSupportQueueLoading] = useState(true);
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState('');
  const [selectedSupportDetail, setSelectedSupportDetail] = useState<SupportTicketDetail | null>(
    null
  );
  const [supportEditorState, setSupportEditorState] =
    useState<SupportEditorState>(createEmptySupportEditorState);
  const [isSupportDetailLoading, setIsSupportDetailLoading] = useState(false);
  const [isSupportSaving, setIsSupportSaving] = useState(false);
  const [activeSupportAction, setActiveSupportAction] = useState<SupportActionId | null>(null);
  const [supportActionErrors, setSupportActionErrors] =
    useState<Record<SupportActionId, string>>(createSupportActionMessages);
  const [supportActionSuccesses, setSupportActionSuccesses] =
    useState<Record<SupportActionId, string>>(createSupportActionMessages);
  const [supportDirty, setSupportDirty] = useState(false);

  const [jobRoles, setJobRoles] = useState<JobHuntRole[]>([]);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<JobHuntFilterValue>('all');
  const [jobLaneFilter, setJobLaneFilter] = useState<JobHuntLaneFilterValue>('all');
  const [jobSource, setJobSource] = useState('');
  const [jobLoadError, setJobLoadError] = useState('');
  const [jobSaveError, setJobSaveError] = useState('');
  const [isJobLoading, setIsJobLoading] = useState(true);
  const [isJobSaving, setIsJobSaving] = useState(false);
  const [selectedJobRoleId, setSelectedJobRoleId] = useState('');
  const [jobEditorState, setJobEditorState] = useState<JobHuntEditorState>(() =>
    createJobHuntEditorState(null)
  );
  const [jobDirty, setJobDirty] = useState(false);
  const [jobSaveSuccess, setJobSaveSuccess] = useState('');
  const [todayIsoDate, setTodayIsoDate] = useState('');

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredSupportSearchTerm = useDeferredValue(supportSearchTerm);
  const deferredJobSearchTerm = useDeferredValue(jobSearchTerm);

  useEffect(() => {
    const workspaceParam = new URLSearchParams(window.location.search).get('workspace');

    if (workspaceParam === 'support') {
      setActiveWorkspace('support');
      return;
    }

    if (workspaceParam === 'job-hunt') {
      setActiveWorkspace('job-hunt');
      return;
    }

    if (workspaceParam === 'builders') {
      setActiveWorkspace('builders');
    }
  }, []);

  function updateWorkspaceInUrl(workspace: WorkspaceView) {
    const nextParams = new URLSearchParams(window.location.search);

    if (workspace === 'support' || workspace === 'job-hunt') {
      nextParams.set('workspace', workspace);
    } else {
      nextParams.delete('workspace');
    }

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadBuilders() {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch('/api/get-builders', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });

        const payload = (await response.json()) as BuildersResponse;

        if (!response.ok || !payload.success || !payload.rows) {
          throw new Error(payload.error || 'Failed to load builders.');
        }

        setBuilders(payload.rows);
        setSource(payload.source || '');
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          caughtError instanceof Error ? caughtError.message : 'Failed to load builders.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBuilders();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSupportQueue() {
      setIsSupportQueueLoading(true);
      setSupportLoadError('');

      try {
        const response = await fetch('/api/support/tickets', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });

        const payload = (await response.json()) as SupportQueueResponse;

        if (!response.ok || !payload.success || !payload.tickets) {
          throw new Error(payload.error || 'Failed to load support queue.');
        }

        setSupportTickets(payload.tickets);
        setSelectedSupportTicketId((currentId) =>
          currentId || payload.tickets?.[0]?.ticketId || ''
        );
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setSupportLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load support queue.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSupportQueueLoading(false);
        }
      }
    }

    void loadSupportQueue();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedBuilder(null);
      setFormState(createEmptyFormState());
      setDetailError('');
      setSaveError('');
      setSaveSuccess('');
      setActiveDraftField(null);
      setDraftErrors(createEmptyDraftMessages());
      setDraftSuccesses(createEmptyDraftMessages());
      setIsFindingContact(false);
      setContactError('');
      setContactSuccess('');
      setIsDetailLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadBuilderDetail() {
      setIsDetailLoading(true);
      setDetailError('');
      setSaveError('');
      setSaveSuccess('');
      setActiveDraftField(null);
      setDraftErrors(createEmptyDraftMessages());
      setDraftSuccesses(createEmptyDraftMessages());
      setIsFindingContact(false);
      setContactError('');
      setContactSuccess('');

      try {
        const response = await fetch(`/api/builders/${encodeURIComponent(selectedLeadId)}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });

        const payload = (await response.json()) as BuilderDetailResponse;

        if (!response.ok || !payload.success || !payload.builder) {
          throw new Error(payload.error || 'Failed to load builder details.');
        }

        setSelectedBuilder(payload.builder);
        setFormState(
          DETAIL_FIELDS.reduce((nextFormState, field) => {
            nextFormState[field.key] = payload.builder?.[field.key] ?? '';
            return nextFormState;
          }, {} as Partial<BuilderRecord>)
        );
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setSelectedBuilder(null);
        setFormState(createEmptyFormState());
        setDetailError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load builder details.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadBuilderDetail();

    return () => {
      controller.abort();
    };
  }, [selectedLeadId]);

  useEffect(() => {
    if (!selectedSupportTicketId) {
      setSelectedSupportDetail(null);
      setSupportEditorState(createEmptySupportEditorState());
      setSupportError('');
      setSupportSaveError('');
      setSupportSaveSuccess('');
      setSupportActionErrors(createSupportActionMessages());
      setSupportActionSuccesses(createSupportActionMessages());
      setActiveSupportAction(null);
      setSupportDirty(false);
      return;
    }

    const controller = new AbortController();

    async function loadSupportDetail() {
      setIsSupportDetailLoading(true);
      setSupportError('');
      setSupportSaveError('');
      setSupportSaveSuccess('');
      setSupportActionErrors(createSupportActionMessages());
      setSupportActionSuccesses(createSupportActionMessages());
      setActiveSupportAction(null);

      try {
        const response = await fetch(
          `/api/support/tickets/${encodeURIComponent(selectedSupportTicketId)}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
          }
        );

        const payload = (await response.json()) as SupportDetailResponse;

        if (!response.ok || !payload.success || !payload.detail) {
          throw new Error(payload.error || 'Failed to load support ticket.');
        }

        setSelectedSupportDetail(payload.detail);
        setSupportEditorState(createSupportEditorStateFromDetail(payload.detail));
        setSupportDirty(false);
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setSelectedSupportDetail(null);
        setSupportEditorState(createEmptySupportEditorState());
        setSupportError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load support ticket.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSupportDetailLoading(false);
        }
      }
    }

    void loadSupportDetail();

    return () => {
      controller.abort();
    };
  }, [selectedSupportTicketId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobHuntRoles() {
      setIsJobLoading(true);
      setJobLoadError('');

      try {
        const response = await fetch('/api/job-hunt/opportunities', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });

        const payload = (await response.json()) as JobHuntQueueResponse;

        if (!response.ok || !payload.success || !payload.opportunities) {
          throw new Error(payload.error || 'Failed to load job opportunities.');
        }

        setJobRoles(payload.opportunities);
        setJobSource(payload.source || '');
        setSelectedJobRoleId((currentId) =>
          currentId || payload.opportunities?.[0]?.opportunity_id || ''
        );
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setJobLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load job opportunities.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsJobLoading(false);
        }
      }
    }

    void loadJobHuntRoles();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedJobRoleId) {
      setJobEditorState(createJobHuntEditorState(null));
      setJobDirty(false);
      setJobSaveError('');
      return;
    }

    const selectedRole = jobRoles.find(
      (role) => role.opportunity_id === selectedJobRoleId
    );

    if (!selectedRole) {
      setSelectedJobRoleId(jobRoles[0]?.opportunity_id || '');
      return;
    }

    setJobEditorState(createJobHuntEditorState(selectedRole));
    setJobDirty(false);
    setJobSaveError('');
  }, [jobRoles, selectedJobRoleId]);

  useEffect(() => {
    if (!saveSuccess && !supportSaveSuccess && !jobSaveSuccess) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSaveSuccess('');
      setSupportSaveSuccess('');
      setJobSaveSuccess('');
    }, 2500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [jobSaveSuccess, saveSuccess, supportSaveSuccess]);

  useEffect(() => {
    setTodayIsoDate(new Date().toISOString().slice(0, 10));
  }, []);

  const tierOptions = useMemo(() => {
    const options = new Set<string>();

    for (const builder of builders) {
      if (builder.tier) {
        options.add(builder.tier);
      }
    }

    return ['all', ...Array.from(options).sort((left, right) => left.localeCompare(right))];
  }, [builders]);

  const filteredBuilders = useMemo(() => {
    const normalizedSearchTerm = normalizeFilterValue(deferredSearchTerm);

    return builders.filter((builder) => {
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        normalizeFilterValue(builder.company_name).includes(normalizedSearchTerm) ||
        normalizeFilterValue(builder.city).includes(normalizedSearchTerm);

      const matchesTier =
        tierFilter === 'all' ||
        normalizeFilterValue(builder.tier) === normalizeFilterValue(tierFilter);

      return matchesSearch && matchesTier;
    });
  }, [builders, deferredSearchTerm, tierFilter]);

  const filteredSupportTickets = useMemo(() => {
    const normalizedSearchTerm = normalizeFilterValue(deferredSupportSearchTerm);

    return supportTickets.filter((ticket) => {
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        normalizeFilterValue(ticket.customerName).includes(normalizedSearchTerm) ||
        normalizeFilterValue(ticket.customerEmail).includes(normalizedSearchTerm) ||
        normalizeFilterValue(ticket.subject).includes(normalizedSearchTerm);

      const matchesStatus =
        supportStatusFilter === 'all' || ticket.currentStatus === supportStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [deferredSupportSearchTerm, supportStatusFilter, supportTickets]);

  const filteredJobRoles = useMemo(() => {
    const normalizedSearchTerm = normalizeFilterValue(deferredJobSearchTerm);

    return jobRoles.filter((role) => {
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        normalizeFilterValue(role.company_name).includes(normalizedSearchTerm) ||
        normalizeFilterValue(role.role_title).includes(normalizedSearchTerm) ||
        normalizeFilterValue(role.lane).includes(normalizedSearchTerm);

      const matchesStatus = jobStatusFilter === 'all' || role.status === jobStatusFilter;
      const matchesLane = jobLaneFilter === 'all' || role.lane === jobLaneFilter;

      return matchesSearch && matchesStatus && matchesLane;
    });
  }, [deferredJobSearchTerm, jobLaneFilter, jobRoles, jobStatusFilter]);

  const todayQueueRoles = useMemo(
    () =>
      [...filteredJobRoles]
        .filter(
          (role) =>
            (todayIsoDate !== '' &&
              role.follow_up_date &&
              role.follow_up_date <= todayIsoDate) ||
            role.status === 'Ready to apply' ||
            role.story_match_score >= 92
        )
        .sort((left, right) => scoreJobRole(right) - scoreJobRole(left))
        .slice(0, 5),
    [filteredJobRoles, todayIsoDate]
  );

  const newJobRoles = useMemo(
    () =>
      [...filteredJobRoles]
        .filter((role) => role.status === 'New' || role.status === 'Reviewing')
        .sort((left, right) => right.date_found.localeCompare(left.date_found))
        .slice(0, 5),
    [filteredJobRoles]
  );

  const activePipelineRoles = useMemo(
    () =>
      [...filteredJobRoles]
        .filter((role) => JOB_HUNT_ACTIVE_PIPELINE_STATUSES.includes(role.status))
        .sort((left, right) => scoreJobRole(right) - scoreJobRole(left))
        .slice(0, 6),
    [filteredJobRoles]
  );

  const priorityJobRoles = useMemo(
    () =>
      [...filteredJobRoles]
        .filter(
          (role) =>
            (role.story_match_score >= 90 || role.fit_score >= 90) &&
            role.status !== 'Not a fit' &&
            role.status !== 'Rejected' &&
            role.status !== 'Archived'
        )
        .sort((left, right) => scoreJobRole(right) - scoreJobRole(left))
        .slice(0, 5),
    [filteredJobRoles]
  );

  const selectedJobRole = useMemo(
    () => jobRoles.find((role) => role.opportunity_id === selectedJobRoleId) || null,
    [jobRoles, selectedJobRoleId]
  );

  function handleSelectBuilder(leadId: string) {
    setSelectedLeadId(leadId);
  }

  function handleSelectJobRole(roleId: string) {
    if (roleId === selectedJobRoleId) {
      return;
    }

    if (jobDirty && !window.confirm('Discard unsaved Job Hunt draft changes?')) {
      return;
    }

    const nextRole = jobRoles.find((role) => role.opportunity_id === roleId);

    setSelectedJobRoleId(roleId);
    setJobEditorState(createJobHuntEditorState(nextRole || null));
    setJobDirty(false);
    setJobSaveError('');
    setJobSaveSuccess('');
  }

  function handleJobFieldChange<K extends keyof JobHuntRole>(key: K, value: JobHuntRole[K]) {
    setJobEditorState((currentState) => ({
      ...currentState,
      [key]: value
    }));
    setJobDirty(true);
    setJobSaveError('');
    setJobSaveSuccess('');
  }

  function handleDiscardJobChanges() {
    if (!selectedJobRole) {
      return;
    }

    setJobEditorState(createJobHuntEditorState(selectedJobRole));
    setJobDirty(false);
    setJobSaveError('');
    setJobSaveSuccess('');
  }

  async function handleSaveJobRole() {
    if (!selectedJobRoleId) {
      return;
    }

    setIsJobSaving(true);
    setJobSaveError('');
    setJobSaveSuccess('');

    try {
      const response = await fetch(
        `/api/job-hunt/opportunities/${encodeURIComponent(selectedJobRoleId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(jobEditorState)
        }
      );

      const payload = (await response.json()) as JobHuntDetailResponse;

      if (!response.ok || !payload.success || !payload.opportunity) {
        throw new Error(payload.error || 'Failed to save opportunity.');
      }

      const savedOpportunity = payload.opportunity;

      setJobRoles((currentRoles) => {
        const existingIndex = currentRoles.findIndex(
          (role) => role.opportunity_id === savedOpportunity.opportunity_id
        );

        if (existingIndex === -1) {
          return [...currentRoles, savedOpportunity];
        }

        return currentRoles.map((role) =>
          role.opportunity_id === savedOpportunity.opportunity_id
            ? savedOpportunity
            : role
        );
      });
      setJobEditorState(createJobHuntEditorState(savedOpportunity));
      setJobDirty(false);
      setJobSaveSuccess('Saved to Google Sheets.');
    } catch (caughtError) {
      setJobSaveError(
        caughtError instanceof Error ? caughtError.message : 'Failed to save opportunity.'
      );
    } finally {
      setIsJobSaving(false);
    }
  }

  function handleCloseBuilderPanel() {
    setSelectedLeadId('');
  }

  function handleFieldChange(key: keyof BuilderRecord, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value
    }));
    setSaveError('');
    setSaveSuccess('');

    if (isAiDraftField(key)) {
      setDraftErrors((currentMessages) => ({
        ...currentMessages,
        [key]: ''
      }));
      setDraftSuccesses((currentMessages) => ({
        ...currentMessages,
        [key]: ''
      }));
    }

    if (isRecommendedContactField(key)) {
      setContactError('');
      setContactSuccess('');
    }
  }

  async function handleFindBestContact() {
    if (!selectedLeadId) {
      return;
    }

    setIsFindingContact(true);
    setContactError('');
    setContactSuccess('');

    try {
      const response = await fetch(
        `/api/builders/${encodeURIComponent(selectedLeadId)}/find-best-contact`,
        {
          method: 'POST'
        }
      );

      const result = (await response.json()) as BuilderContactResponse;

      if (!response.ok || !result.success || !result.builder) {
        throw new Error(result.error || 'Failed to find best contact.');
      }

      setSelectedBuilder(result.builder);
      setFormState((currentState) => ({
        ...currentState,
        ...DETAIL_FIELDS.reduce((nextFormState, field) => {
          nextFormState[field.key] = result.builder?.[field.key] ?? '';
          return nextFormState;
        }, {} as Partial<BuilderRecord>)
      }));
      setBuilders((currentBuilders) =>
        currentBuilders.map((builder) =>
          builder.lead_id === result.builder?.lead_id ? result.builder : builder
        )
      );
      setContactSuccess('Best contact found and saved to Google Sheets.');
    } catch (caughtError) {
      setContactError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to find best contact.'
      );
    } finally {
      setIsFindingContact(false);
    }
  }

  async function handleGenerateDraft(draftField: AiDraftField) {
    if (!selectedLeadId) {
      return;
    }

    setActiveDraftField(draftField);
    setDraftErrors((currentMessages) => ({
      ...currentMessages,
      [draftField]: ''
    }));
    setDraftSuccesses((currentMessages) => ({
      ...currentMessages,
      [draftField]: ''
    }));

    try {
      const response = await fetch(
        `/api/builders/${encodeURIComponent(selectedLeadId)}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ draftField })
        }
      );

      const result = (await response.json()) as BuilderDraftResponse;

      if (!response.ok || !result.success || !result.builder || !result.draftField) {
        throw new Error(result.error || 'Failed to generate draft.');
      }

      setSelectedBuilder(result.builder);
      setFormState((currentState) => ({
        ...currentState,
        ...DETAIL_FIELDS.reduce((nextFormState, field) => {
          nextFormState[field.key] = result.builder?.[field.key] ?? '';
          return nextFormState;
        }, {} as Partial<BuilderRecord>)
      }));
      setBuilders((currentBuilders) =>
        currentBuilders.map((builder) =>
          builder.lead_id === result.builder?.lead_id ? result.builder : builder
        )
      );
      const savedDraftField = result.draftField;
      setDraftSuccesses((currentMessages) => ({
        ...currentMessages,
        [savedDraftField]: 'Draft generated and saved to Google Sheets.'
      }));
    } catch (caughtError) {
      setDraftErrors((currentMessages) => ({
        ...currentMessages,
        [draftField]:
          caughtError instanceof Error ? caughtError.message : 'Failed to generate draft.'
      }));
    } finally {
      setActiveDraftField(null);
    }
  }

  async function handleSaveBuilder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLeadId) {
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const payload = DETAIL_FIELDS.reduce((nextPayload, field) => {
        nextPayload[field.key] = `${formState[field.key] ?? ''}`.trim();
        return nextPayload;
      }, {} as Partial<BuilderRecord>);

      const response = await fetch(`/api/builders/${encodeURIComponent(selectedLeadId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as BuilderDetailResponse;

      if (!response.ok || !result.success || !result.builder) {
        throw new Error(result.error || 'Failed to save builder.');
      }

      setSelectedBuilder(result.builder);
      setFormState(
        DETAIL_FIELDS.reduce((nextFormState, field) => {
          nextFormState[field.key] = result.builder?.[field.key] ?? '';
          return nextFormState;
        }, {} as Partial<BuilderRecord>)
      );
      setBuilders((currentBuilders) =>
        currentBuilders.map((builder) =>
          builder.lead_id === result.builder?.lead_id ? result.builder : builder
        )
      );
      setSaveSuccess('Saved to Google Sheets.');
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : 'Failed to save builder.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateSelectedSupportQueuePreview(nextState: SupportEditorState) {
    if (!selectedSupportTicketId) {
      return;
    }

    setSupportTickets((currentTickets) =>
      currentTickets.map((ticket) =>
        ticket.ticketId === selectedSupportTicketId
          ? buildSupportQueuePreview(ticket, nextState)
          : ticket
      )
    );
  }

  function handleSelectSupportTicket(ticketId: string) {
    if (ticketId === selectedSupportTicketId) {
      return;
    }

    if (supportDirty && !window.confirm('Discard unsaved support draft changes?')) {
      return;
    }

    setSelectedSupportTicketId(ticketId);
  }

  function handleSupportFieldChange(
    key:
      | 'customerName'
      | 'accountId'
      | 'propertyId'
      | 'binderId'
      | 'resolvedContactId'
      | 'subject'
      | 'body'
      | 'currentStatus'
      | 'priorNotes',
    value: string
  ) {
    const nextState = {
      ...supportEditorState,
      [key]: key === 'currentStatus' ? (value as SupportStatus) : value
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
    setSupportError('');
    setSupportSaveError('');
    setSupportSaveSuccess('');
    updateSelectedSupportQueuePreview(nextState);
  }

  function handleAccountContextFieldChange(
    key:
      | 'customer'
      | 'account_status'
      | 'plan_or_tier'
      | 'recent_activity_summary'
      | 'recommended_support_context',
    value: string
  ) {
    const nextSummary: SupportAccountContextSummary = {
      customer: supportEditorState.accountContextSummary?.customer || '',
      account_status: supportEditorState.accountContextSummary?.account_status || '',
      plan_or_tier: supportEditorState.accountContextSummary?.plan_or_tier || '',
      recent_activity_summary:
        supportEditorState.accountContextSummary?.recent_activity_summary || '',
      relevant_documents_or_records:
        supportEditorState.accountContextSummary?.relevant_documents_or_records || [],
      risk_flags: supportEditorState.accountContextSummary?.risk_flags || [],
      recommended_support_context:
        supportEditorState.accountContextSummary?.recommended_support_context || ''
    };

    nextSummary[key] = value;

    const nextState = {
      ...supportEditorState,
      accountContextSummary: nextSummary
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
  }

  function handleAccountContextListChange(
    key: 'relevant_documents_or_records' | 'risk_flags',
    value: string
  ) {
    const nextSummary: SupportAccountContextSummary = {
      customer: supportEditorState.accountContextSummary?.customer || '',
      account_status: supportEditorState.accountContextSummary?.account_status || '',
      plan_or_tier: supportEditorState.accountContextSummary?.plan_or_tier || '',
      recent_activity_summary:
        supportEditorState.accountContextSummary?.recent_activity_summary || '',
      relevant_documents_or_records:
        supportEditorState.accountContextSummary?.relevant_documents_or_records || [],
      risk_flags: supportEditorState.accountContextSummary?.risk_flags || [],
      recommended_support_context:
        supportEditorState.accountContextSummary?.recommended_support_context || ''
    };

    nextSummary[key] = splitList(value);

    const nextState = {
      ...supportEditorState,
      accountContextSummary: nextSummary
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
  }

  function handleReplyDraftFieldChange(
    key: 'subject' | 'reply_body' | 'tone' | 'escalation_hint',
    value: string
  ) {
    const currentDraft = supportEditorState.replyDraft || {
      subject: '',
      reply_body: '',
      tone: '',
      needs_human_review: false,
      follow_up_questions: [],
      escalation_hint: ''
    };

    const nextState = {
      ...supportEditorState,
      replyDraft: {
        ...currentDraft,
        [key]: value
      }
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
    updateSelectedSupportQueuePreview(nextState);
  }

  function handleReplyQuestionChange(value: string) {
    const currentDraft = supportEditorState.replyDraft || {
      subject: '',
      reply_body: '',
      tone: '',
      needs_human_review: false,
      follow_up_questions: [],
      escalation_hint: ''
    };

    const nextState = {
      ...supportEditorState,
      replyDraft: {
        ...currentDraft,
        follow_up_questions: splitList(value)
      }
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
    updateSelectedSupportQueuePreview(nextState);
  }

  function handleEscalationFieldChange(
    key:
      | 'escalation_title'
      | 'escalation_summary'
      | 'recommended_owner'
      | 'internal_next_step',
    value: string
  ) {
    const currentEscalation = supportEditorState.escalation || {
      escalation_title: '',
      escalation_summary: '',
      severity: '',
      recommended_owner: '',
      blocking_unknowns: [],
      customer_impact: '',
      internal_next_step: ''
    };

    const nextState = {
      ...supportEditorState,
      escalation: {
        ...currentEscalation,
        [key]: value
      }
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
    updateSelectedSupportQueuePreview(nextState);
  }

  function handleEscalationUnknownsChange(value: string) {
    const currentEscalation = supportEditorState.escalation || {
      escalation_title: '',
      escalation_summary: '',
      severity: '',
      recommended_owner: '',
      blocking_unknowns: [],
      customer_impact: '',
      internal_next_step: ''
    };

    const nextState = {
      ...supportEditorState,
      escalation: {
        ...currentEscalation,
        blocking_unknowns: splitList(value)
      }
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
    updateSelectedSupportQueuePreview(nextState);
  }

  async function handleRunSupportAction(actionId: SupportActionId) {
    if (!selectedSupportTicketId) {
      return;
    }

    setActiveSupportAction(actionId);
    setSupportActionErrors((currentMessages) => ({
      ...currentMessages,
      [actionId]: ''
    }));
    setSupportActionSuccesses((currentMessages) => ({
      ...currentMessages,
      [actionId]: ''
    }));
    setSupportError('');

    try {
      if (actionId === 'classify_ticket') {
        const response = await fetch('/api/support/classify-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticketId: selectedSupportTicketId,
            subject: supportEditorState.subject,
            body: supportEditorState.body,
            threadTranscript: selectedSupportDetail?.transcript || '',
            customerName: supportEditorState.customerName,
            customerEmail: selectedSupportDetail?.ticket.customerEmail || '',
            accountId: supportEditorState.accountId,
            currentStatus: supportEditorState.currentStatus,
            priorNotes: supportEditorState.priorNotes,
            ...buildSupportActionLogContext(supportEditorState)
          })
        });

        const result = (await response.json()) as SupportClassifyResponse;

        if (!response.ok || !result.success || !result.classification) {
          throw new Error(result.error || 'Failed to classify ticket.');
        }

        const nextState = {
          ...supportEditorState,
          classification: result.classification
        };

        setSupportEditorState(nextState);
        setSupportDirty(true);
        updateSelectedSupportQueuePreview(nextState);
      }

      if (actionId === 'summarize_account_context') {
        if (
          supportEditorState.accountResolution?.resolutionStatus === 'ambiguous' &&
          !supportEditorState.accountId
        ) {
          throw new Error(
            'Account resolution is ambiguous. Select an account before summarizing account context.'
          );
        }

        const response = await fetch('/api/support/summarize-account-context', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticketId: selectedSupportTicketId,
            accountId: supportEditorState.accountId,
            customerName: supportEditorState.customerName,
            customerEmail: selectedSupportDetail?.ticket.customerEmail || '',
            subject: supportEditorState.subject,
            body: supportEditorState.body,
            threadTranscript: selectedSupportDetail?.transcript || '',
            currentStatus: supportEditorState.currentStatus,
            priorNotes: supportEditorState.priorNotes,
            accountSnapshot: supportEditorState.accountId
              ? [
                  `Resolved account ID: ${supportEditorState.accountId}`,
                  supportEditorState.propertyId
                    ? `Resolved property ID: ${supportEditorState.propertyId}`
                    : '',
                  supportEditorState.binderId
                    ? `Resolved binder ID: ${supportEditorState.binderId}`
                    : '',
                  supportEditorState.resolvedContactId
                    ? `Resolved contact ID: ${supportEditorState.resolvedContactId}`
                    : '',
                  `Resolution status: ${
                    supportEditorState.accountResolution?.resolutionStatus || 'unresolved'
                  }`
                ]
                  .filter(Boolean)
                  .join('\n')
              : 'No linked account resolved from sender email yet.',
            ...buildSupportActionLogContext(supportEditorState)
          })
        });

        const result = (await response.json()) as SupportSummaryResponse;

        if (!response.ok || !result.success || !result.summary) {
          throw new Error(result.error || 'Failed to summarize account context.');
        }

        const nextState = {
          ...supportEditorState,
          accountContextSummary: result.summary
        };

        setSupportEditorState(nextState);
        setSupportDirty(true);
      }

      if (actionId === 'draft_support_reply') {
        const response = await fetch('/api/support/draft-support-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticketId: selectedSupportTicketId,
            accountId: supportEditorState.accountId,
            customerName: supportEditorState.customerName,
            customerEmail: selectedSupportDetail?.ticket.customerEmail || '',
            subject: supportEditorState.subject,
            body: supportEditorState.body,
            threadTranscript: selectedSupportDetail?.transcript || '',
            currentStatus: supportEditorState.currentStatus,
            priorNotes: supportEditorState.priorNotes,
            accountContextSummary: summarizeAccountContext(
              supportEditorState.accountContextSummary
            ),
            ...buildSupportActionLogContext(supportEditorState)
          })
        });

        const result = (await response.json()) as SupportReplyResponse;

        if (!response.ok || !result.success || !result.draft) {
          throw new Error(result.error || 'Failed to draft support reply.');
        }

        const nextState = {
          ...supportEditorState,
          replyDraft: result.draft
        };

        setSupportEditorState(nextState);
        setSupportDirty(true);
        updateSelectedSupportQueuePreview(nextState);
      }

      if (actionId === 'prepare_escalation') {
        const response = await fetch('/api/support/prepare-escalation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticketId: selectedSupportTicketId,
            accountId: supportEditorState.accountId,
            customerName: supportEditorState.customerName,
            customerEmail: selectedSupportDetail?.ticket.customerEmail || '',
            subject: supportEditorState.subject,
            body: supportEditorState.body,
            threadTranscript: selectedSupportDetail?.transcript || '',
            currentStatus: supportEditorState.currentStatus,
            classificationSummary: summarizeClassification(supportEditorState.classification),
            accountContextSummary: summarizeAccountContext(
              supportEditorState.accountContextSummary
            ),
            draftReplySummary: summarizeReplyDraft(supportEditorState.replyDraft),
            priorNotes: supportEditorState.priorNotes,
            ...buildSupportActionLogContext(supportEditorState)
          })
        });

        const result = (await response.json()) as SupportEscalationResponse;

        if (!response.ok || !result.success || !result.escalation) {
          throw new Error(result.error || 'Failed to prepare escalation.');
        }

        const nextState = {
          ...supportEditorState,
          escalation: result.escalation
        };

        setSupportEditorState(nextState);
        setSupportDirty(true);
        updateSelectedSupportQueuePreview(nextState);
      }

      setSupportActionSuccesses((currentMessages) => ({
        ...currentMessages,
        [actionId]: 'Draft result ready for internal review.'
      }));
    } catch (caughtError) {
      setSupportActionErrors((currentMessages) => ({
        ...currentMessages,
        [actionId]:
          caughtError instanceof Error
            ? caughtError.message
            : 'Support action failed.'
      }));
    } finally {
      setActiveSupportAction(null);
    }
  }

  async function handleSaveSupportDraft() {
    await persistSupportDraft(supportEditorState, 'Internal support draft saved.');
  }

  async function persistSupportDraft(nextState: SupportEditorState, successMessage: string) {
    if (!selectedSupportTicketId) {
      return;
    }

    setIsSupportSaving(true);
    setSupportSaveError('');
    setSupportSaveSuccess('');

    try {
      const response = await fetch(
        `/api/support/tickets/${encodeURIComponent(selectedSupportTicketId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(nextState)
        }
      );

      const result = (await response.json()) as SupportDetailResponse;

      if (!response.ok || !result.success || !result.detail) {
        throw new Error(result.error || 'Failed to save support draft.');
      }

      setSelectedSupportDetail(result.detail);
      setSupportEditorState(createSupportEditorStateFromDetail(result.detail));
      setSupportDirty(false);
      setSupportSaveSuccess(successMessage);

      const queueResponse = await fetch('/api/support/tickets', {
        method: 'GET',
        cache: 'no-store'
      });
      const queuePayload = (await queueResponse.json()) as SupportQueueResponse;

      if (queueResponse.ok && queuePayload.success && queuePayload.tickets) {
        setSupportTickets(queuePayload.tickets);
      }
    } catch (caughtError) {
      setSupportSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to save support draft.'
      );
    } finally {
      setIsSupportSaving(false);
    }
  }

  async function handleApplyResolutionCandidate(candidateIndex: number) {
    const candidate = supportEditorState.accountResolution?.candidateMatches[candidateIndex];

    if (!candidate) {
      return;
    }

    const nextState: SupportEditorState = {
      ...supportEditorState,
      accountId: candidate.account?.id || '',
      propertyId: candidate.property?.id || '',
      binderId: candidate.binder?.id || '',
      resolvedContactId: candidate.matchedContact?.id || '',
      accountResolution: buildManualResolutionFromCandidate(
        candidate,
        supportEditorState.accountResolution
      )
    };

    setSupportEditorState(nextState);
    setSupportDirty(true);
    setSupportError('');
    setSupportSaveError('');
    setSupportSaveSuccess('');
    updateSelectedSupportQueuePreview(nextState);

    await persistSupportDraft(nextState, 'Ambiguous match applied to the support draft.');
  }

  function handleDiscardSupportChanges() {
    if (!selectedSupportDetail) {
      return;
    }

    setSupportEditorState(createSupportEditorStateFromDetail(selectedSupportDetail));
    setSupportActionErrors(createSupportActionMessages());
    setSupportActionSuccesses(createSupportActionMessages());
    setSupportSaveError('');
    setSupportSaveSuccess('');
    setSupportDirty(false);
    setSupportTickets((currentTickets) =>
      currentTickets.map((ticket) =>
        ticket.ticketId === selectedSupportDetail.ticket.ticketId && selectedSupportDetail.draft
          ? buildSupportQueuePreview(
              ticket,
              createSupportEditorStateFromDetail(selectedSupportDetail)
            )
          : ticket
      )
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Shared Dashboard
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Use the shared control-plane to operate GTM and Support workflows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveWorkspace('builders');
              updateWorkspaceInUrl('builders');
            }}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              activeWorkspace === 'builders'
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950'
                : 'border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900'
            }`}
          >
            Builders
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWorkspace('support');
              updateWorkspaceInUrl('support');
            }}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              activeWorkspace === 'support'
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950'
                : 'border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900'
            }`}
          >
            Support
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWorkspace('job-hunt');
              updateWorkspaceInUrl('job-hunt');
            }}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              activeWorkspace === 'job-hunt'
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950'
                : 'border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900'
            }`}
          >
            Job Hunt
          </button>
        </div>
      </section>

      {activeWorkspace === 'builders' ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Builders
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Review builder rows from Google Sheets in a simple list view.
            </p>
          </div>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid gap-3 md:grid-cols-[minmax(0,20rem)_12rem]">
                  <BuilderFilters
                    searchTerm={searchTerm}
                    tierFilter={tierFilter}
                    tierOptions={tierOptions}
                    onSearchTermChange={setSearchTerm}
                    onTierFilterChange={setTierFilter}
                  />
                </div>

                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  <p>
                    Showing{' '}
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {filteredBuilders.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {builders.length}
                    </span>{' '}
                    builders
                  </p>
                  {source ? <p className="truncate">Source: {source}</p> : null}
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-900">
                      <tr>
                        {TABLE_COLUMNS.map((column) => (
                          <th
                            key={column.key}
                            className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-neutral-950">
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={TABLE_COLUMNS.length}
                            className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
                          >
                            Loading builders...
                          </td>
                        </tr>
                      ) : filteredBuilders.length === 0 ? (
                        <tr>
                          <td
                            colSpan={TABLE_COLUMNS.length}
                            className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
                          >
                            No builders match the current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredBuilders.map((builder) => (
                          <tr
                            key={builder.lead_id}
                            className={`cursor-pointer border-t border-neutral-200 align-top transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900 ${
                              selectedLeadId === builder.lead_id
                                ? 'bg-neutral-50 dark:bg-neutral-900'
                                : ''
                            }`}
                            onClick={() => handleSelectBuilder(builder.lead_id)}
                            aria-selected={selectedLeadId === builder.lead_id}
                          >
                            {TABLE_COLUMNS.map((column) => (
                              <td
                                key={column.key}
                                className="px-4 py-3 text-neutral-700 dark:text-neutral-300"
                              >
                                {builder[column.key] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="flex min-h-[20rem] flex-col rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Builder Detail
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {selectedBuilder?.company_name || 'Select a builder row to edit.'}
                  </p>
                </div>
              </div>

              {!selectedLeadId ? (
                <div className="flex flex-1 items-center justify-center px-4 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Click any builder row to open the detail panel.
                </div>
              ) : isDetailLoading ? (
                <div className="flex flex-1 items-center justify-center px-4 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Loading builder details...
                </div>
              ) : detailError ? (
                <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {detailError}
                </div>
              ) : (
                <form onSubmit={handleSaveBuilder} className="flex min-h-0 flex-1 flex-col">
                  <div className="grid gap-3 overflow-y-auto px-4 py-4">
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          Contact Research
                        </p>
                        <button
                          type="button"
                          onClick={handleFindBestContact}
                          disabled={isFindingContact}
                          className="rounded-md border border-neutral-300 px-3 py-2 text-left text-sm text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                        >
                          {isFindingContact
                            ? 'Finding best contact...'
                            : 'Find best contact'}
                        </button>

                        {contactError ? (
                          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                            {contactError}
                          </div>
                        ) : null}

                        {contactSuccess ? (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {contactSuccess}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          AI Assist
                        </p>
                        <div className="flex flex-col gap-2">
                          {AI_ACTIONS.map((action) => (
                            <div key={action.draftField} className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => handleGenerateDraft(action.draftField)}
                                disabled={activeDraftField !== null}
                                className="rounded-md border border-neutral-300 px-3 py-2 text-left text-sm text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                              >
                                {activeDraftField === action.draftField
                                  ? 'Generating...'
                                  : action.label}
                              </button>

                              {draftErrors[action.draftField] ? (
                                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                                  {draftErrors[action.draftField]}
                                </div>
                              ) : null}

                              {draftSuccesses[action.draftField] ? (
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  {draftSuccesses[action.draftField]}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {DETAIL_FIELDS.map((field) => (
                      <label
                        key={field.key}
                        className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300"
                      >
                        <span className="font-medium">{field.label}</span>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={formState[field.key] ?? ''}
                            onChange={(event) =>
                              handleFieldChange(field.key, event.target.value)
                            }
                            rows={isAiDraftField(field.key) ? 7 : 5}
                            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          />
                        ) : (
                          <input
                            type={field.type || 'text'}
                            value={formState[field.key] ?? ''}
                            onChange={(event) =>
                              handleFieldChange(field.key, event.target.value)
                            }
                            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          />
                        )}
                      </label>
                    ))}
                  </div>

                  <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>

                      <button
                        type="button"
                        onClick={handleCloseBuilderPanel}
                        className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      >
                        Close
                      </button>
                    </div>

                    {saveError ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                        {saveError}
                      </div>
                    ) : null}

                    {saveSuccess ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {saveSuccess}
                      </div>
                    ) : null}
                  </div>
                </form>
              )}
            </aside>
          </section>
        </section>
      ) : activeWorkspace === 'job-hunt' ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Job Hunt
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Manual-first draft workspace for high-story-match roles, daily follow-ups,
              and narrative prep. Local-only for Phase 1.
            </p>
          </div>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      Brandon Priority Lane
                    </h3>
                    <p className="max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
                      Focus on roles where the sales story is unusually strong: enterprise
                      SaaS selling, founder-led GTM, AI-enabled workflow design, and startup
                      operator credibility.
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-400 md:grid-cols-3">
                    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                      <p className="text-xs uppercase tracking-wide">Today Queue</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        {todayQueueRoles.length}
                      </p>
                    </div>
                    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                      <p className="text-xs uppercase tracking-wide">Active Pipeline</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        {activePipelineRoles.length}
                      </p>
                    </div>
                    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                      <p className="text-xs uppercase tracking-wide">Priority Roles</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        {priorityJobRoles.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_16rem]">
                  <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium">Search</span>
                    <input
                      type="text"
                      value={jobSearchTerm}
                      onChange={(event) => setJobSearchTerm(event.target.value)}
                      placeholder="Company, role, or lane"
                      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium">Status</span>
                    <select
                      value={jobStatusFilter}
                      onChange={(event) =>
                        setJobStatusFilter(event.target.value as JobHuntFilterValue)
                      }
                      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      <option value="all">All statuses</option>
                      {JOB_HUNT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium">Role lane</span>
                    <select
                      value={jobLaneFilter}
                      onChange={(event) =>
                        setJobLaneFilter(event.target.value as JobHuntLaneFilterValue)
                      }
                      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      <option value="all">All lanes</option>
                      {JOB_HUNT_LANES.map((lane) => (
                        <option key={lane} value={lane}>
                          {lane}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                  Manual sheet-backed tracking only. This view does not scrape, auto-apply,
                  or send anything externally.
                </p>

                {jobSource ? (
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                    Source: {jobSource}
                  </p>
                ) : null}

                {jobLoadError ? (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {jobLoadError}
                  </div>
                ) : null}
              </div>

              <section className="grid gap-4 xl:grid-cols-2">
                <JobHuntSectionCard
                  title="Today Queue"
                  description="Follow-ups first, then strongest story-match roles that need a concrete next step."
                  emptyMessage={
                    isJobLoading
                      ? 'Loading opportunities...'
                      : 'No roles are due today for the current filters.'
                  }
                >
                  {todayQueueRoles.map((role) => (
                    <JobHuntRoleCard
                      key={role.opportunity_id}
                      role={role}
                      isSelected={selectedJobRoleId === role.opportunity_id}
                      subtitle={getTodayQueueReason(role, todayIsoDate)}
                      onSelect={handleSelectJobRole}
                    />
                  ))}
                </JobHuntSectionCard>

                <JobHuntSectionCard
                  title="New Roles"
                  description="Fresh roles that still need review or qualification."
                  emptyMessage={
                    isJobLoading
                      ? 'Loading opportunities...'
                      : 'No new or reviewing roles match the current filters.'
                  }
                >
                  {newJobRoles.map((role) => (
                    <JobHuntRoleCard
                      key={role.opportunity_id}
                      role={role}
                      isSelected={selectedJobRoleId === role.opportunity_id}
                      subtitle={`Found ${formatDateLabel(role.date_found)}`}
                      onSelect={handleSelectJobRole}
                    />
                  ))}
                </JobHuntSectionCard>

                <JobHuntSectionCard
                  title="Active Pipeline"
                  description="Qualified roles already in motion, sorted by blended priority."
                  emptyMessage={
                    isJobLoading
                      ? 'Loading opportunities...'
                      : 'No active pipeline roles match the current filters.'
                  }
                >
                  {activePipelineRoles.map((role) => (
                    <JobHuntRoleCard
                      key={role.opportunity_id}
                      role={role}
                      isSelected={selectedJobRoleId === role.opportunity_id}
                      subtitle={`Resume: ${role.resume_version || 'not set'}`}
                      onSelect={handleSelectJobRole}
                    />
                  ))}
                </JobHuntSectionCard>

                <JobHuntSectionCard
                  title="Priority Roles"
                  description="High-fit or high-story-match roles worth extra attention."
                  emptyMessage={
                    isJobLoading
                      ? 'Loading opportunities...'
                      : 'No priority roles match the current filters.'
                  }
                >
                  {priorityJobRoles.map((role) => (
                    <JobHuntRoleCard
                      key={role.opportunity_id}
                      role={role}
                      isSelected={selectedJobRoleId === role.opportunity_id}
                      subtitle={role.narrative_angle}
                      onSelect={handleSelectJobRole}
                    />
                  ))}
                </JobHuntSectionCard>
              </section>
            </div>

            <aside className="flex min-h-[36rem] flex-col rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Role Draft
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {selectedJobRole
                      ? `${jobEditorState.company_name} • ${jobEditorState.role_title}`
                      : 'Select a role to review and update the draft fields.'}
                  </p>
                </div>
              </div>

              {!selectedJobRole ? (
                <div className="flex flex-1 items-center justify-center px-4 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  No Job Hunt role is selected.
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="grid gap-4 overflow-y-auto px-4 py-4">
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Quick Snapshot
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Manual Phase 1 tracking only.
                          </p>
                        </div>

                        <a
                          href={jobEditorState.posting_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-neutral-300 px-3 py-2 text-xs text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                        >
                          Open posting
                        </a>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${getJobRoleStatusTone(jobEditorState.status)}`}
                        >
                          {jobEditorState.status}
                        </span>
                        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                          {jobEditorState.lane}
                        </span>
                        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                          Follow-up {formatDateLabel(jobEditorState.follow_up_date)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Role Basics
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Core role metadata for local tracking.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Company</span>
                            <input
                              type="text"
                              value={jobEditorState.company_name}
                              onChange={(event) =>
                                handleJobFieldChange('company_name', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Role Title</span>
                            <input
                              type="text"
                              value={jobEditorState.role_title}
                              onChange={(event) =>
                                handleJobFieldChange('role_title', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Role Lane</span>
                            <select
                              value={jobEditorState.lane}
                              onChange={(event) =>
                                handleJobFieldChange('lane', event.target.value as JobHuntLane)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              {JOB_HUNT_LANES.map((lane) => (
                                <option key={lane} value={lane}>
                                  {lane}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Status</span>
                            <select
                              value={jobEditorState.status}
                              onChange={(event) =>
                                handleJobFieldChange(
                                  'status',
                                  event.target.value as JobHuntStatus
                                )
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              {JOB_HUNT_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Location</span>
                            <input
                              type="text"
                              value={jobEditorState.location}
                              onChange={(event) =>
                                handleJobFieldChange('location', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Work Model</span>
                            <input
                              type="text"
                              value={jobEditorState.work_model}
                              onChange={(event) =>
                                handleJobFieldChange('work_model', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Comp Estimate</span>
                            <input
                              type="text"
                              value={jobEditorState.compensation_estimate}
                              onChange={(event) =>
                                handleJobFieldChange(
                                  'compensation_estimate',
                                  event.target.value
                                )
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Source</span>
                            <input
                              type="text"
                              value={jobEditorState.source}
                              onChange={(event) =>
                                handleJobFieldChange('source', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                            <span className="font-medium">Posting URL</span>
                            <input
                              type="url"
                              value={jobEditorState.posting_url}
                              onChange={(event) =>
                                handleJobFieldChange('posting_url', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Date Found</span>
                            <input
                              type="date"
                              value={jobEditorState.date_found}
                              onChange={(event) =>
                                handleJobFieldChange('date_found', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Follow-up Date</span>
                            <input
                              type="date"
                              value={jobEditorState.follow_up_date}
                              onChange={(event) =>
                                handleJobFieldChange('follow_up_date', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Scoring
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            High story-match should outweigh raw volume.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Fit Score</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={jobEditorState.fit_score}
                              onChange={(event) =>
                                handleJobFieldChange(
                                  'fit_score',
                                  Number(event.target.value || 0)
                                )
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Story Match</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={jobEditorState.story_match_score}
                              onChange={(event) =>
                                handleJobFieldChange(
                                  'story_match_score',
                                  Number(event.target.value || 0)
                                )
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Urgency</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={jobEditorState.urgency_score}
                              onChange={(event) =>
                                handleJobFieldChange(
                                  'urgency_score',
                                  Number(event.target.value || 0)
                                )
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Narrative Draft
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Internal notes only. No outreach or sends from this screen.
                          </p>
                        </div>

                        <div className="grid gap-3">
                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Why This Role</span>
                            <textarea
                              value={jobEditorState.why_this_role}
                              onChange={(event) =>
                                handleJobFieldChange('why_this_role', event.target.value)
                              }
                              rows={4}
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Why Brandon Wins Here</span>
                            <textarea
                              value={jobEditorState.why_brandon_wins_here}
                              onChange={(event) =>
                                handleJobFieldChange(
                                  'why_brandon_wins_here',
                                  event.target.value
                                )
                              }
                              rows={4}
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Narrative Angle</span>
                            <textarea
                              value={jobEditorState.narrative_angle}
                              onChange={(event) =>
                                handleJobFieldChange('narrative_angle', event.target.value)
                              }
                              rows={4}
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Resume Version</span>
                            <input
                              type="text"
                              value={jobEditorState.resume_version}
                              onChange={(event) =>
                                handleJobFieldChange('resume_version', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveJobRole}
                        disabled={!jobDirty || isJobSaving}
                        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                      >
                        {isJobSaving ? 'Saving...' : 'Save local draft'}
                      </button>

                      <button
                        type="button"
                        onClick={handleDiscardJobChanges}
                        disabled={!jobDirty}
                        className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      >
                        Discard local edits
                      </button>
                    </div>

                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Draft-only workflow. Saves update the Job Hunt Google Sheet and do not
                      trigger any external outreach or applications.
                    </p>

                    {jobSaveSuccess ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {jobSaveSuccess}
                      </div>
                    ) : null}

                    {jobSaveError ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                        {jobSaveError}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </aside>
          </section>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Support
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Internal-only operator workspace for ticket triage, context review,
              reply drafting, and escalation prep.
            </p>
          </div>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <aside className="flex min-h-[36rem] flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Support Queue
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Internal inbox view for the Support workspace.
                  </p>
                </div>

                <div className="grid gap-3">
                  <SupportFilters
                    searchTerm={supportSearchTerm}
                    statusFilter={supportStatusFilter}
                    onSearchTermChange={setSupportSearchTerm}
                    onStatusFilterChange={setSupportStatusFilter}
                  />
                </div>

                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  Showing{' '}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {filteredSupportTickets.length}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {supportTickets.length}
                  </span>{' '}
                  tickets
                </div>
              </div>

              {supportLoadError ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {supportLoadError}
                </div>
              ) : null}

              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {isSupportQueueLoading ? (
                  <div className="rounded-md border border-neutral-200 px-3 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    Loading support queue...
                  </div>
                ) : filteredSupportTickets.length === 0 ? (
                  <div className="rounded-md border border-neutral-200 px-3 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    No support tickets match the current filters.
                  </div>
                ) : (
                  filteredSupportTickets.map((ticket) => (
                    <button
                      key={ticket.ticketId}
                      type="button"
                      onClick={() => handleSelectSupportTicket(ticket.ticketId)}
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        selectedSupportTicketId === ticket.ticketId
                          ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900'
                          : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {ticket.customerName || 'Unknown customer'}
                          </p>
                          <p className="truncate text-sm text-neutral-700 dark:text-neutral-300">
                            {ticket.subject || 'No subject'}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                          {ticket.currentStatus}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                          {ticket.channel}
                        </span>
                        {ticket.customerEmail ? (
                          <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                            {ticket.customerEmail}
                          </span>
                        ) : null}
                        {ticket.needsHumanReview ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                            needs human review
                          </span>
                        ) : null}
                        {ticket.hasDraftReply ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                            draft reply ready
                          </span>
                        ) : null}
                        {ticket.hasEscalationDraft ? (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                            escalation ready
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        Updated {formatTimestamp(ticket.lastUpdatedAt)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="flex min-h-[36rem] flex-col rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      Selected Ticket
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {supportEditorState.subject || 'Select a support ticket to begin.'}
                    </p>
                  </div>

                  {selectedSupportDetail ? (
                    <div className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-400">
                      <p>
                        Ticket ID:{' '}
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {selectedSupportDetail.ticket.ticketId}
                        </span>
                      </p>
                      <p>
                        Channel:{' '}
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {selectedSupportDetail.ticket.channel}
                        </span>
                      </p>
                      <p>
                        Customer email:{' '}
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {selectedSupportDetail.ticket.customerEmail || '—'}
                        </span>
                      </p>
                      <p>
                        Last updated:{' '}
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {formatTimestamp(selectedSupportDetail.ticket.lastUpdatedAt)}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {!selectedSupportTicketId ? (
                <div className="flex flex-1 items-center justify-center px-4 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Select any support ticket from the queue.
                </div>
              ) : isSupportDetailLoading ? (
                <div className="flex flex-1 items-center justify-center px-4 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Loading support ticket...
                </div>
              ) : supportError ? (
                <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {supportError}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="grid gap-4 overflow-y-auto px-4 py-4">
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Ticket Context
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Editable operator context. Internal-only.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Customer</span>
                            <input
                              type="text"
                              value={supportEditorState.customerName}
                              onChange={(event) =>
                                handleSupportFieldChange('customerName', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Account ID</span>
                            <input
                              type="text"
                              value={supportEditorState.accountId}
                              onChange={(event) =>
                                handleSupportFieldChange('accountId', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Property ID</span>
                            <input
                              type="text"
                              value={supportEditorState.propertyId}
                              onChange={(event) =>
                                handleSupportFieldChange('propertyId', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Binder ID</span>
                            <input
                              type="text"
                              value={supportEditorState.binderId}
                              onChange={(event) =>
                                handleSupportFieldChange('binderId', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Contact ID</span>
                            <input
                              type="text"
                              value={supportEditorState.resolvedContactId}
                              onChange={(event) =>
                                handleSupportFieldChange(
                                  'resolvedContactId',
                                  event.target.value
                                )
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                            <span className="font-medium">Subject</span>
                            <input
                              type="text"
                              value={supportEditorState.subject}
                              onChange={(event) =>
                                handleSupportFieldChange('subject', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Current Status</span>
                            <select
                              value={supportEditorState.currentStatus}
                              onChange={(event) =>
                                handleSupportFieldChange('currentStatus', event.target.value)
                              }
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              {SUPPORT_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Ticket ID</span>
                            <input
                              type="text"
                              value={selectedSupportDetail?.ticket.ticketId || ''}
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                            <span className="font-medium">Body</span>
                            <textarea
                              value={supportEditorState.body}
                              onChange={(event) =>
                                handleSupportFieldChange('body', event.target.value)
                              }
                              rows={6}
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                            <span className="font-medium">Prior Notes</span>
                            <textarea
                              value={supportEditorState.priorNotes}
                              onChange={(event) =>
                                handleSupportFieldChange('priorNotes', event.target.value)
                              }
                              rows={4}
                              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Account Resolution
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Read-only resolver metadata from sender email plus operator-selected
                            IDs above.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Sender Email</span>
                            <input
                              type="text"
                              value={selectedSupportDetail?.ticket.customerEmail || ''}
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Resolution Status</span>
                            <input
                              type="text"
                              value={
                                supportEditorState.accountResolution?.resolutionStatus || 'unresolved'
                              }
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Matched Contact</span>
                            <input
                              type="text"
                              value={
                                supportEditorState.accountResolution?.matchedContact
                                  ? `${
                                      supportEditorState.accountResolution.matchedContact.name ||
                                      supportEditorState.accountResolution.matchedContact.id ||
                                      'Unknown contact'
                                    }${
                                      supportEditorState.accountResolution.matchedContact.email
                                        ? ` <${supportEditorState.accountResolution.matchedContact.email}>`
                                        : ''
                                    }`
                                  : '—'
                              }
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Match Method / Confidence</span>
                            <input
                              type="text"
                              value={
                                supportEditorState.accountResolution
                                  ? `${supportEditorState.accountResolution.matchMethod} / ${supportEditorState.accountResolution.confidence}`
                                  : 'none / low'
                              }
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Resolved Account</span>
                            <input
                              type="text"
                              value={
                                supportEditorState.accountResolution?.account
                                  ? `${
                                      supportEditorState.accountResolution.account.name ||
                                      supportEditorState.accountResolution.account.id
                                    }`
                                  : '—'
                              }
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">Resolved Property</span>
                            <input
                              type="text"
                              value={
                                supportEditorState.accountResolution?.property
                                  ? `${
                                      supportEditorState.accountResolution.property.name ||
                                      supportEditorState.accountResolution.property.id
                                    }`
                                  : '—'
                              }
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                            <span className="font-medium">Resolved Binder</span>
                            <input
                              type="text"
                              value={
                                supportEditorState.accountResolution?.binder
                                  ? `${
                                      supportEditorState.accountResolution.binder.name ||
                                      supportEditorState.accountResolution.binder.id
                                    }`
                                  : '—'
                              }
                              readOnly
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                            <span className="font-medium">Candidate Matches</span>
                            <textarea
                              value={
                                supportEditorState.accountResolution?.candidateMatches.length
                                  ? supportEditorState.accountResolution.candidateMatches
                                      .map(summarizeResolutionCandidate)
                                      .join('\n')
                                  : ''
                              }
                              readOnly
                              rows={4}
                              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            />
                          </label>

                          {supportEditorState.accountResolution?.resolutionStatus ===
                            'ambiguous' &&
                          supportEditorState.accountResolution.candidateMatches.length ? (
                            <div className="md:col-span-2">
                              <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                      Resolve Ambiguity
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                      Pick one candidate to populate the contact, account,
                                      property, and binder IDs.
                                    </p>
                                  </div>

                                  <div className="grid gap-2">
                                    {supportEditorState.accountResolution.candidateMatches.map(
                                      (candidate, index) => (
                                        <button
                                          key={`${candidate.account?.id || candidate.account?.name || 'candidate'}-${index}`}
                                          type="button"
                                          onClick={() => void handleApplyResolutionCandidate(index)}
                                          disabled={isSupportSaving}
                                          className="flex items-center justify-between gap-3 rounded-md border border-neutral-300 px-3 py-2 text-left text-sm text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                                        >
                                          <span className="min-w-0">
                                            {summarizeResolutionCandidate(candidate) ||
                                              `Candidate ${index + 1}`}
                                          </span>
                                          <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                                            Use match
                                          </span>
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Thread Transcript
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Read-only Gmail thread content from the Support label.
                          </p>
                        </div>

                        {selectedSupportDetail?.messages.length ? (
                          <div className="grid gap-3">
                            {selectedSupportDetail.messages.map((message) => (
                              <div
                                key={message.id}
                                className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                  <span className="rounded-full border border-neutral-200 px-2 py-0.5 dark:border-neutral-800">
                                    {message.isInbound ? 'Inbound' : 'Internal/Outbound'}
                                  </span>
                                  <span>{formatTimestamp(message.sentAt)}</span>
                                </div>
                                <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                  {message.fromName
                                    ? `${message.fromName} <${message.fromEmail}>`
                                    : message.fromEmail || 'Unknown sender'}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  To: {message.to || '—'}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  Subject: {message.subject || '—'}
                                </p>
                                <div className="mt-3 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                                  {message.body || '(no readable body)'}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyCardState message="No readable thread messages found." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Support Actions
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Run the internal-only Support workspace actions against the
                            selected ticket context.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {SUPPORT_ACTIONS.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => handleRunSupportAction(action.id)}
                              disabled={activeSupportAction !== null}
                              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                            >
                              {activeSupportAction === action.id
                                ? 'Running...'
                                : action.label}
                            </button>
                          ))}
                        </div>

                        {SUPPORT_ACTIONS.map((action) =>
                          supportActionErrors[action.id] ? (
                            <div
                              key={`${action.id}-error`}
                              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                            >
                              {supportActionErrors[action.id]}
                            </div>
                          ) : supportActionSuccesses[action.id] ? (
                            <div
                              key={`${action.id}-success`}
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              {action.label}: {supportActionSuccesses[action.id]}
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Classification
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Read-only action output.
                          </p>
                        </div>

                        {supportEditorState.classification ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <ReadOnlyField
                              label="Issue Type"
                              value={supportEditorState.classification.issue_type}
                            />
                            <ReadOnlyField
                              label="Priority"
                              value={supportEditorState.classification.priority}
                            />
                            <ReadOnlyField
                              label="SLA Risk"
                              value={supportEditorState.classification.sla_risk}
                            />
                            <ReadOnlyField
                              label="Needs Human Review"
                              value={
                                supportEditorState.classification.needs_human_review
                                  ? 'true'
                                  : 'false'
                              }
                            />
                            <ReadOnlyField
                              label="Recommended Next Step"
                              value={
                                supportEditorState.classification.recommended_next_step
                              }
                              multiline
                            />
                            <ReadOnlyField
                              label="Escalation Reason"
                              value={supportEditorState.classification.escalation_reason}
                              multiline
                            />
                          </div>
                        ) : (
                          <EmptyCardState message="No classification draft yet." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Account Context Summary
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Internal draft fields. Narrative and list fields are editable.
                          </p>
                        </div>

                        {supportEditorState.accountContextSummary ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Customer</span>
                              <textarea
                                value={supportEditorState.accountContextSummary.customer}
                                onChange={(event) =>
                                  handleAccountContextFieldChange(
                                    'customer',
                                    event.target.value
                                  )
                                }
                                rows={2}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Account Status</span>
                              <textarea
                                value={
                                  supportEditorState.accountContextSummary.account_status
                                }
                                onChange={(event) =>
                                  handleAccountContextFieldChange(
                                    'account_status',
                                    event.target.value
                                  )
                                }
                                rows={2}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Plan or Tier</span>
                              <textarea
                                value={supportEditorState.accountContextSummary.plan_or_tier}
                                onChange={(event) =>
                                  handleAccountContextFieldChange(
                                    'plan_or_tier',
                                    event.target.value
                                  )
                                }
                                rows={2}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                              <span className="font-medium">Recent Activity Summary</span>
                              <textarea
                                value={
                                  supportEditorState.accountContextSummary
                                    .recent_activity_summary
                                }
                                onChange={(event) =>
                                  handleAccountContextFieldChange(
                                    'recent_activity_summary',
                                    event.target.value
                                  )
                                }
                                rows={4}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">
                                Relevant Documents or Records
                              </span>
                              <textarea
                                value={joinList(
                                  supportEditorState.accountContextSummary
                                    .relevant_documents_or_records
                                )}
                                onChange={(event) =>
                                  handleAccountContextListChange(
                                    'relevant_documents_or_records',
                                    event.target.value
                                  )
                                }
                                rows={4}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Risk Flags</span>
                              <textarea
                                value={joinList(
                                  supportEditorState.accountContextSummary.risk_flags
                                )}
                                onChange={(event) =>
                                  handleAccountContextListChange(
                                    'risk_flags',
                                    event.target.value
                                  )
                                }
                                rows={4}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                              <span className="font-medium">
                                Recommended Support Context
                              </span>
                              <textarea
                                value={
                                  supportEditorState.accountContextSummary
                                    .recommended_support_context
                                }
                                onChange={(event) =>
                                  handleAccountContextFieldChange(
                                    'recommended_support_context',
                                    event.target.value
                                  )
                                }
                                rows={4}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>
                          </div>
                        ) : (
                          <EmptyCardState message="No account context summary draft yet." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Reply Draft
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Editable internal-only draft. No send action.
                          </p>
                        </div>

                        {supportEditorState.replyDraft ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                              <span className="font-medium">Subject</span>
                              <input
                                type="text"
                                value={supportEditorState.replyDraft.subject}
                                onChange={(event) =>
                                  handleReplyDraftFieldChange(
                                    'subject',
                                    event.target.value
                                  )
                                }
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                              <span className="font-medium">Reply Body</span>
                              <textarea
                                value={supportEditorState.replyDraft.reply_body}
                                onChange={(event) =>
                                  handleReplyDraftFieldChange(
                                    'reply_body',
                                    event.target.value
                                  )
                                }
                                rows={6}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Tone</span>
                              <input
                                type="text"
                                value={supportEditorState.replyDraft.tone}
                                onChange={(event) =>
                                  handleReplyDraftFieldChange('tone', event.target.value)
                                }
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <ReadOnlyField
                              label="Needs Human Review"
                              value={
                                supportEditorState.replyDraft.needs_human_review
                                  ? 'true'
                                  : 'false'
                              }
                            />

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Follow-up Questions</span>
                              <textarea
                                value={joinList(
                                  supportEditorState.replyDraft.follow_up_questions
                                )}
                                onChange={(event) =>
                                  handleReplyQuestionChange(event.target.value)
                                }
                                rows={4}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <ReadOnlyField
                              label="Escalation Hint"
                              value={supportEditorState.replyDraft.escalation_hint}
                              multiline
                            />
                          </div>
                        ) : (
                          <EmptyCardState message="No reply draft yet." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              Escalation Draft
                            </p>
                            <button
                              type="button"
                              onClick={() => handleRunSupportAction('prepare_escalation')}
                              disabled={activeSupportAction !== null}
                              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                            >
                              {activeSupportAction === 'prepare_escalation'
                                ? 'Running...'
                                : 'Rerun escalation'}
                            </button>
                          </div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Internal-only handoff draft.
                          </p>
                        </div>

                        {supportEditorState.escalation ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                              <span className="font-medium">Escalation Title</span>
                              <input
                                type="text"
                                value={supportEditorState.escalation.escalation_title}
                                onChange={(event) =>
                                  handleEscalationFieldChange(
                                    'escalation_title',
                                    event.target.value
                                  )
                                }
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                              <span className="font-medium">Escalation Summary</span>
                              <textarea
                                value={supportEditorState.escalation.escalation_summary}
                                onChange={(event) =>
                                  handleEscalationFieldChange(
                                    'escalation_summary',
                                    event.target.value
                                  )
                                }
                                rows={5}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <ReadOnlyField
                              label="Severity"
                              value={supportEditorState.escalation.severity}
                            />

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Recommended Owner</span>
                              <input
                                type="text"
                                value={supportEditorState.escalation.recommended_owner}
                                onChange={(event) =>
                                  handleEscalationFieldChange(
                                    'recommended_owner',
                                    event.target.value
                                  )
                                }
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">Blocking Unknowns</span>
                              <textarea
                                value={joinList(
                                  supportEditorState.escalation.blocking_unknowns
                                )}
                                onChange={(event) =>
                                  handleEscalationUnknownsChange(event.target.value)
                                }
                                rows={4}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>

                            <ReadOnlyField
                              label="Customer Impact"
                              value={supportEditorState.escalation.customer_impact}
                              multiline
                            />

                            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 md:col-span-2">
                              <span className="font-medium">Internal Next Step</span>
                              <textarea
                                value={supportEditorState.escalation.internal_next_step}
                                onChange={(event) =>
                                  handleEscalationFieldChange(
                                    'internal_next_step',
                                    event.target.value
                                  )
                                }
                                rows={4}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </label>
                          </div>
                        ) : (
                          <EmptyCardState message="No escalation draft yet." />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveSupportDraft}
                        disabled={isSupportSaving}
                        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                      >
                        {isSupportSaving ? 'Saving...' : 'Save internal draft'}
                      </button>

                      <button
                        type="button"
                        onClick={handleDiscardSupportChanges}
                        disabled={!supportDirty}
                        className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      >
                        Discard local edits
                      </button>
                    </div>

                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Internal-only. All Support outputs remain drafts and nothing sends
                      externally from this screen.
                    </p>

                    {supportSaveError ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                        {supportSaveError}
                      </div>
                    ) : null}

                    {supportSaveSuccess ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {supportSaveSuccess}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          </section>
        </section>
      )}
    </main>
  );
}

function ReadOnlyField({
  label,
  value,
  multiline = false
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
      <span className="font-medium">{label}</span>
      <div
        className={`rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 ${
          multiline ? 'min-h-24 whitespace-pre-wrap' : ''
        }`}
      >
        {value || '—'}
      </div>
    </div>
  );
}

function JobHuntSectionCard({
  title,
  description,
  emptyMessage,
  children
}: {
  title: string;
  description: string;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : children !== null && children !== undefined;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {hasChildren ? children : <EmptyCardState message={emptyMessage} />}
      </div>
    </div>
  );
}

function JobHuntRoleCard({
  role,
  isSelected,
  subtitle,
  onSelect
}: {
  role: JobHuntRole;
  isSelected: boolean;
  subtitle: string;
  onSelect: (roleId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role.opportunity_id)}
      className={`rounded-lg border px-3 py-3 text-left transition ${
        isSelected
          ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900'
          : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {role.company_name}
          </p>
          <p className="truncate text-sm text-neutral-700 dark:text-neutral-300">
            {role.role_title}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${getJobRoleStatusTone(role.status)}`}
        >
          {role.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          {role.lane}
        </span>
        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          {role.location}
        </span>
        <ScorePill label="fit" value={role.fit_score} />
        <ScorePill label="story" value={role.story_match_score} />
        <ScorePill label="urgency" value={role.urgency_score} />
      </div>

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {subtitle}
      </p>
    </button>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
      {label} {value}
    </span>
  );
}

function EmptyCardState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
      {message}
    </div>
  );
}
