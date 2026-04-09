export type WorkflowKey =
  | 'doc_capture'
  | 'product_import'
  | 'metadata_polish'
  | 'maintenance_writer';

export type RunMode = 'dry_run' | 'apply' | 'read_only';

export type RunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'blocked';

export type WorkflowStatusRecord = {
  project_id: string;
  workflow_key: WorkflowKey;
  last_run_at: string | null;
  last_run_mode: RunMode | null;
  last_run_status: RunStatus | null;
  latest_error_code: string | null;
  latest_error_summary: string | null;
  counts_json: Record<string, number> | null;
  artifact_refs: string[];
  action_allowed: boolean;
  action_block_reason: string | null;
};

export type ProjectOperationsSummary = {
  projectId: string;
  unresolvedCount: number | null;
  reviewNeededCount: number | null;
  topBlockers: string[] | null;
  workflows: WorkflowStatusRecord[];
};

export type ProjectOperationsPanelState = {
  projectIds: string[];
  selectedProjectId: string;
  summary: ProjectOperationsSummary;
};
