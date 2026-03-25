import { execFile } from 'child_process';
import { promisify } from 'util';
import { getWorkspace, getWorkspaceActionPolicy } from '@/lib/workspaces';

const execFileAsync = promisify(execFile);
const OPENCLAW_BIN = '/home/gtm-employee/.npm-global/bin/openclaw';
const MAX_STDIO_BUFFER_BYTES = 1024 * 1024;

export type OpenClawExecutionInput = {
  workspaceId: string;
  actionId: string;
  payload: Record<string, unknown>;
};

export type OpenClawExecutionResult = {
  workspaceId: string;
  actionId: string;
  cwd: string;
  durationMs: number;
  attempts: number;
  requiresApproval: boolean;
  draftOnly: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | string;
};

function buildActionMessage(
  workspaceDisplayName: string,
  actionId: string,
  payload: Record<string, unknown>
) {
  return [
    `Execute workspace action "${actionId}" for "${workspaceDisplayName}".`,
    'Run within the current workspace boundary and follow the local RULES.md and skills.',
    'Use only the structured payload below.',
    'Reply only with the final action result.',
    '',
    JSON.stringify(
      {
        actionId,
        payload
      },
      null,
      2
    )
  ].join('\n');
}

export async function executeOpenClawAction(
  input: OpenClawExecutionInput
): Promise<OpenClawExecutionResult> {
  const workspace = getWorkspace(input.workspaceId);
  const actionPolicy = getWorkspaceActionPolicy(input.workspaceId, input.actionId);
  const maxAttempts = Math.max(1, workspace.execution.maxRetries + 1);
  const startedAt = Date.now();
  let attempts = 0;
  let lastError: unknown;

  while (attempts < maxAttempts) {
    attempts += 1;

    try {
      const { stdout, stderr } = await execFileAsync(
        OPENCLAW_BIN,
        [
          'agent',
          '--local',
          '--agent',
          'main',
          '--timeout',
          `${Math.ceil(workspace.execution.timeoutMs / 1000)}`,
          '--message',
          buildActionMessage(workspace.displayName, input.actionId, input.payload)
        ],
        {
          cwd: workspace.paths.cwd,
          env: { ...process.env, PATH: process.env.PATH || '/usr/bin:/bin' },
          timeout: workspace.execution.timeoutMs,
          maxBuffer: MAX_STDIO_BUFFER_BYTES
        }
      );

      return {
        workspaceId: workspace.id,
        actionId: input.actionId,
        cwd: workspace.paths.cwd,
        durationMs: Date.now() - startedAt,
        attempts,
        requiresApproval: actionPolicy.requiresApproval,
        draftOnly: workspace.execution.draftOnly,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0
      };
    } catch (error: unknown) {
      lastError = error;
    }
  }

  const execError = lastError as NodeJS.ErrnoException & {
    stdout?: string;
    stderr?: string;
    code?: string | number;
  };

  throw Object.assign(
    new Error(execError?.message || 'OpenClaw execution failed.'),
    {
      workspaceId: workspace.id,
      actionId: input.actionId,
      cwd: workspace.paths.cwd,
      durationMs: Date.now() - startedAt,
      attempts,
      requiresApproval: actionPolicy.requiresApproval,
      draftOnly: workspace.execution.draftOnly,
      stdout: execError?.stdout?.trim() || '',
      stderr: execError?.stderr?.trim() || '',
      exitCode: execError?.code || 'UNKNOWN'
    }
  );
}
