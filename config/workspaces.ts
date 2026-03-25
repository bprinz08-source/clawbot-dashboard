export type WorkspaceActionPolicy = {
  id: string;
  requiresApproval: boolean;
};

export type WorkspaceSourceAdapter = {
  id: string;
  type: string;
  target: string;
  readOnly?: boolean;
};

export type WorkspaceRegistryEntry = {
  id: string;
  displayName: string;
  workspaceRoot: string;
  paths?: {
    cwd?: string;
    rules?: string;
    state?: string;
    skills?: string;
    artifacts?: string;
  };
  allowedActions: WorkspaceActionPolicy[];
  allowedReadTargets: string[];
  allowedWriteTargets: string[];
  sourceAdapters: WorkspaceSourceAdapter[];
  execution: {
    timeoutMs: number;
    maxRetries: number;
    draftOnly: boolean;
  };
};

export const WORKSPACES = {
  asbuilt_gtm: {
    id: 'asbuilt_gtm',
    displayName: 'AsBuilt GTM',
    workspaceRoot: '/home/gtm-employee/clawbot_workspace',
    allowedActions: [
      { id: 'discover_builders', requiresApproval: false },
      { id: 'qualify_builder', requiresApproval: false },
      { id: 'find_best_contact', requiresApproval: false },
      { id: 'generate_call_talk_track', requiresApproval: false },
      { id: 'generate_followup_email', requiresApproval: false },
      { id: 'generate_linkedin_connect', requiresApproval: false }
    ],
    allowedReadTargets: [
      'google_sheets.builders',
      'public.builder_web',
      'public.linkedin',
      'public.directory_pages'
    ],
    allowedWriteTargets: ['google_sheets.builders'],
    sourceAdapters: [
      {
        id: 'builders_crm',
        type: 'google_sheets',
        target: 'builders sheet'
      }
    ],
    execution: {
      timeoutMs: 180000,
      maxRetries: 1,
      draftOnly: true
    }
  },
  asbuilt_support: {
    id: 'asbuilt_support',
    displayName: 'AsBuilt Support',
    workspaceRoot: '/home/gtm-employee/workspaces/asbuilt-support',
    allowedActions: [
      { id: 'classify_ticket', requiresApproval: false },
      { id: 'summarize_account_context', requiresApproval: false },
      { id: 'draft_support_reply', requiresApproval: true },
      { id: 'prepare_escalation', requiresApproval: false }
    ],
    allowedReadTargets: [
      'support.inbox',
      'supabase.app_records',
      'support.help_docs'
    ],
    allowedWriteTargets: ['support.ticket_notes', 'support.draft_replies'],
    sourceAdapters: [
      {
        id: 'support_inbox',
        type: 'support_inbox',
        target: 'support provider inbox'
      },
      {
        id: 'supabase_app',
        type: 'supabase',
        target: 'app records',
        readOnly: true
      }
    ],
    execution: {
      timeoutMs: 180000,
      maxRetries: 1,
      draftOnly: true
    }
  },
  asbuilt_execution: {
    id: 'asbuilt_execution',
    displayName: 'AsBuilt Execution',
    workspaceRoot: '/home/gtm-employee/workspaces/asbuilt-execution',
    allowedActions: [
      { id: 'summarize_blocker', requiresApproval: false },
      { id: 'prepare_handoff', requiresApproval: false },
      { id: 'update_execution_note', requiresApproval: false },
      { id: 'triage_task', requiresApproval: false }
    ],
    allowedReadTargets: [
      'execution.project_system',
      'execution.app_data',
      'execution.process_docs'
    ],
    allowedWriteTargets: ['execution.task_notes', 'execution.status_fields'],
    sourceAdapters: [
      {
        id: 'task_system',
        type: 'project_system',
        target: 'project/task platform'
      },
      {
        id: 'app_data',
        type: 'application_db',
        target: 'operational app data',
        readOnly: true
      }
    ],
    execution: {
      timeoutMs: 180000,
      maxRetries: 1,
      draftOnly: true
    }
  },
  side_hustles: {
    id: 'side_hustles',
    displayName: 'Side Hustles',
    workspaceRoot: '/home/gtm-employee/workspaces/side-hustles',
    allowedActions: [
      { id: 'research_opportunity', requiresApproval: false },
      { id: 'score_opportunity', requiresApproval: false },
      { id: 'generate_brief', requiresApproval: false },
      { id: 'draft_outreach', requiresApproval: true }
    ],
    allowedReadTargets: [
      'ideas.tracker',
      'public.market_research',
      'public.competitor_sites'
    ],
    allowedWriteTargets: ['ideas.tracker', 'ideas.briefs'],
    sourceAdapters: [
      {
        id: 'ideas_tracker',
        type: 'tracker',
        target: 'idea/opportunity tracker'
      }
    ],
    execution: {
      timeoutMs: 180000,
      maxRetries: 1,
      draftOnly: true
    }
  }
} satisfies Record<string, WorkspaceRegistryEntry>;

export type WorkspaceId = keyof typeof WORKSPACES;
