import { execFile } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import {
  formatJobHuntStorageError,
  getJobHuntStorageConfig
} from '@/lib/job-hunt-storage';

const execFileAsync = promisify(execFile);
const DISCOVERY_SCRIPT_PATH =
  '/home/gtm-employee/clawbot_workspace/ai-ops/bin/discover_job_hunt_roles.py';
const DISCOVERY_CWD = '/home/gtm-employee/clawbot_workspace';
const TIMEOUT_MS = 180000;
const MAX_STDIO_BUFFER_BYTES = 1024 * 1024;

type DiscoveryScriptOutput = {
  stats?: {
    selected?: number;
    selected_ids?: string[];
    sheet_appended?: number;
    sheet_updated?: number;
    jobs_fetched?: number;
  };
  primary_selected_count?: number;
  watchlist_selected_count?: number;
};

function parseDiscoveryOutput(stdout: string): DiscoveryScriptOutput {
  const trimmedStdout = stdout.trim();

  if (!trimmedStdout) {
    throw new Error('Job Hunt discovery finished without output.');
  }

  const jsonStartIndex = trimmedStdout.indexOf('{');
  const jsonEndIndex = trimmedStdout.lastIndexOf('}');

  if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
    throw new Error('Job Hunt discovery returned an invalid response.');
  }

  return JSON.parse(
    trimmedStdout.slice(jsonStartIndex, jsonEndIndex + 1)
  ) as DiscoveryScriptOutput;
}

export const maxDuration = 180;
export const runtime = 'nodejs';

export async function POST() {
  try {
    const { spreadsheetId } = getJobHuntStorageConfig();

    const { stdout, stderr } = await execFileAsync(
      'python3',
      [DISCOVERY_SCRIPT_PATH, '--sheet-id', spreadsheetId],
      {
        cwd: DISCOVERY_CWD,
        env: { ...process.env, PATH: process.env.PATH || '/usr/bin:/bin' },
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_STDIO_BUFFER_BYTES
      }
    );

    const output = parseDiscoveryOutput(stdout);
    const selectedCount =
      output.primary_selected_count ?? output.stats?.selected ?? 0;
    const appendedCount =
      typeof output.stats?.sheet_appended === 'number'
        ? output.stats.sheet_appended
        : null;
    const updatedCount =
      typeof output.stats?.sheet_updated === 'number'
        ? output.stats.sheet_updated
        : null;

    return NextResponse.json({
      success: true,
      message: 'Fetched latest job listings.',
      run: {
        selectedCount,
        appendedCount,
        updatedCount,
        selectedIds: output.stats?.selected_ids ?? [],
        watchlistSelectedCount: output.watchlist_selected_count ?? 0,
        jobsFetched: output.stats?.jobs_fetched ?? 0
      },
      stderr: stderr.trim()
    });
  } catch (error: unknown) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      killed?: boolean;
      signal?: string;
    };
    const isTimeout = execError.killed && execError.signal === 'SIGTERM';

    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? `Job Hunt discovery timed out after ${TIMEOUT_MS / 1000}s.`
          : execError.stderr?.trim() ||
            execError.message ||
            formatJobHuntStorageError(error) ||
            'Failed to fetch new listings.',
        code: execError.code || (isTimeout ? 'ETIMEDOUT' : 'UNKNOWN')
      },
      { status: 500 }
    );
  }
}
