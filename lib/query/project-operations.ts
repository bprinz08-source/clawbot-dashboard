import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ProjectOperationsPanelState,
  ProjectOperationsSummary,
  RunMode,
  RunStatus,
  WorkflowKey,
  WorkflowStatusRecord,
} from '../types/project-operations';

type Allowlist = {
  allowed_project_ids?: string[];
};

type SnapshotWorkflowRecord = Partial<{
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
}>;

type SnapshotProjectSummary = Partial<{
  unresolvedCount: number | null;
  reviewNeededCount: number | null;
  topBlockers: string[] | null;
  workflows: SnapshotWorkflowRecord[];
}>;

type ProjectOperationsSnapshot = {
  projects?: SnapshotProjectEntry[];
};

type SnapshotProjectEntry = {
  project_id?: string;
  summary?: {
    unresolved_count?: number | null;
    review_needed_count?: number | null;
    top_blockers?: string[] | null;
  };
  workflows?: SnapshotWorkflowRecord[];
};

const DATA_ROOT = path.resolve(
  '/home/gtm-employee/clawbot_workspace',
  'openclaw',
  'data',
  'demo_product_docs_reliable',
);

const ALLOWLIST_PATH = path.join(DATA_ROOT, 'non_prod_project_allowlist.json');
const PROJECT_OPERATIONS_SNAPSHOT_PATH = path.join(DATA_ROOT, 'project_operations_snapshot.json');

const WORKFLOWS: WorkflowKey[] = [
  'doc_capture',
  'product_import',
  'metadata_polish',
  'maintenance_writer',
];

function normalizeProjectId(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    return normalizeProjectId(value[0]);
  }

  return null;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readOptionalJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function buildUnknownWorkflowRecord(
  projectId: string,
  workflowKey: WorkflowKey,
): WorkflowStatusRecord {
  return {
    project_id: projectId,
    workflow_key: workflowKey,
    last_run_at: null,
    last_run_mode: null,
    last_run_status: null,
    latest_error_code: null,
    latest_error_summary: null,
    counts_json: null,
    artifact_refs: [],
    action_allowed: false,
    action_block_reason: 'Upcoming in future version (read-only v1.1)',
  };
}

function buildWorkflowRecord(
  projectId: string,
  workflowKey: WorkflowKey,
  snapshotRecord?: SnapshotWorkflowRecord,
): WorkflowStatusRecord {
  const base = buildUnknownWorkflowRecord(projectId, workflowKey);

  if (!snapshotRecord) {
    return base;
  }

  return {
    project_id: projectId,
    workflow_key: workflowKey,
    last_run_at: snapshotRecord.last_run_at ?? null,
    last_run_mode: snapshotRecord.last_run_mode ?? null,
    last_run_status: normalizeRunStatus(snapshotRecord.last_run_status),
    latest_error_code: snapshotRecord.latest_error_code ?? null,
    latest_error_summary: snapshotRecord.latest_error_summary ?? null,
    counts_json: snapshotRecord.counts_json ?? null,
    artifact_refs: snapshotRecord.artifact_refs ?? [],
    action_allowed: false,
    action_block_reason:
      snapshotRecord.action_block_reason ?? 'Upcoming in future version (read-only v1.1)',
  };
}

function normalizeRunStatus(value: string | null | undefined): RunStatus | null {
  switch (value) {
    case 'idle':
    case 'running':
    case 'succeeded':
    case 'failed':
    case 'blocked':
      return value;
    default:
      return null;
  }
}

function normalizeSnapshotProject(entry?: SnapshotProjectEntry): SnapshotProjectSummary | undefined {
  if (!entry) {
    return undefined;
  }

  return {
    unresolvedCount: entry.summary?.unresolved_count ?? null,
    reviewNeededCount: entry.summary?.review_needed_count ?? null,
    topBlockers: entry.summary?.top_blockers ?? null,
    workflows: entry.workflows ?? [],
  };
}

function buildProjectSummary(
  projectId: string,
  snapshotProject?: SnapshotProjectSummary,
): ProjectOperationsSummary {
  const workflowRecords = new Map<WorkflowKey, SnapshotWorkflowRecord>();

  for (const workflow of snapshotProject?.workflows ?? []) {
    if (workflow.workflow_key) {
      workflowRecords.set(workflow.workflow_key, workflow);
    }
  }

  return {
    projectId,
    unresolvedCount: snapshotProject?.unresolvedCount ?? null,
    reviewNeededCount: snapshotProject?.reviewNeededCount ?? null,
    topBlockers: snapshotProject?.topBlockers ?? null,
    workflows: WORKFLOWS.map((workflowKey) =>
      buildWorkflowRecord(projectId, workflowKey, workflowRecords.get(workflowKey)),
    ),
  };
}

export async function getAllowedProjectIds(): Promise<string[]> {
  const parsed = await readJsonFile<Allowlist>(ALLOWLIST_PATH);
  return parsed.allowed_project_ids ?? [];
}

export async function getProjectOperationsSummary(
  projectId: string,
): Promise<ProjectOperationsSummary> {
  const snapshot = await readOptionalJsonFile<ProjectOperationsSnapshot>(
    PROJECT_OPERATIONS_SNAPSHOT_PATH,
  );
  const snapshotProject = snapshot?.projects?.find((entry) => entry.project_id === projectId);

  return buildProjectSummary(projectId, normalizeSnapshotProject(snapshotProject));
}

export async function getProjectOperationsPanelState(
  requestedProjectId: string | string[] | undefined,
): Promise<ProjectOperationsPanelState> {
  const projectIds = await getAllowedProjectIds();
  const normalizedRequestedProjectId = normalizeProjectId(requestedProjectId);
  const fallbackProjectId = projectIds[0] ?? 'no-allowlisted-project';
  const selectedProjectId =
    normalizedRequestedProjectId && projectIds.includes(normalizedRequestedProjectId)
      ? normalizedRequestedProjectId
      : fallbackProjectId;

  return {
    projectIds: projectIds.length > 0 ? projectIds : [fallbackProjectId],
    selectedProjectId,
    summary: await getProjectOperationsSummary(selectedProjectId),
  };
}
