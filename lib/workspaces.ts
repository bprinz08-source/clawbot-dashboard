import {
  WORKSPACES,
  type WorkspaceActionPolicy,
  type WorkspaceId,
  type WorkspaceRegistryEntry
} from '@/config/workspaces';

export type ResolvedWorkspacePaths = {
  cwd: string;
  rules: string;
  state: string;
  skills: string;
  artifacts: string;
};

export type ResolvedWorkspace = WorkspaceRegistryEntry & {
  paths: ResolvedWorkspacePaths;
};

function resolveWorkspacePaths(entry: WorkspaceRegistryEntry): ResolvedWorkspacePaths {
  return {
    cwd: entry.paths?.cwd || entry.workspaceRoot,
    rules: entry.paths?.rules || `${entry.workspaceRoot}/RULES.md`,
    state: entry.paths?.state || `${entry.workspaceRoot}/STATE.json`,
    skills: entry.paths?.skills || `${entry.workspaceRoot}/skills`,
    artifacts: entry.paths?.artifacts || `${entry.workspaceRoot}/artifacts`
  };
}

export function getWorkspace(workspaceId: string): ResolvedWorkspace {
  const entry = WORKSPACES[workspaceId as WorkspaceId];

  if (!entry) {
    throw new Error(`Unknown workspace: ${workspaceId}`);
  }

  return {
    ...entry,
    paths: resolveWorkspacePaths(entry)
  };
}

export function getWorkspaceActionPolicy(
  workspaceId: string,
  actionId: string
): WorkspaceActionPolicy {
  const workspace = getWorkspace(workspaceId);
  const action = workspace.allowedActions.find((candidate) => candidate.id === actionId);

  if (!action) {
    throw new Error(`Action "${actionId}" is not allowed for workspace "${workspaceId}"`);
  }

  return action;
}

export function assertWorkspaceActionAllowed(workspaceId: string, actionId: string) {
  return getWorkspaceActionPolicy(workspaceId, actionId);
}
