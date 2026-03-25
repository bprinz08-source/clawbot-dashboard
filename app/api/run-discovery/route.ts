import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  formatBuilderStorageError,
  getBuilderStorageTarget,
  loadBuilderRecordsFromDiscoveryOutput,
  upsertBuilderRecords
} from '@/lib/builder-storage';

const execAsync = promisify(exec);

export async function POST() {
  const TIMEOUT_MS = 120000;
  const CANONICAL_SCHEMA = 'lead_id,company_name,website,city,state,builder_type,contact_name,contact_title,phone,email,linkedin_url,source,source_url,tier,priority,status,last_contact_date,next_action,next_action_due,owner,call_talk_track,followup_email_draft,linkedin_connect_draft,notes,enrichment_status,created_at,updated_at';

  const COMMAND = `/home/gtm-employee/.npm-global/bin/openclaw agent \
--local \
--agent main \
--message "Use the BUILDER_LIST_QUALIFIER skill. Load builders_raw.csv from ~/clawbot_workspace. Apply ICP rules from openclaw/ICP_BUILDER_RULES.md. Produce a cleaned ranked CSV using this exact header order: ${CANONICAL_SCHEMA}. Safely map legacy columns into the canonical schema, preserve existing discovery and qualification outputs where possible, and save the result as builders_ranked.csv in the workspace. Reply ONLY with DONE."`;

  try {
    const { stdout, stderr } = await execAsync(COMMAND, {
      timeout: TIMEOUT_MS,
      cwd: '/home/gtm-employee/clawbot_workspace'
    });
    const records = await loadBuilderRecordsFromDiscoveryOutput();
    await upsertBuilderRecords(records);

    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      syncedRows: records.length,
      source: getBuilderStorageTarget()
    });
  } catch (error: unknown) {
    const execError = error as NodeJS.ErrnoException & {
      killed?: boolean;
      signal?: string;
      stdout?: string;
      stderr?: string;
      code?: string | number;
    };
    const isTimeout = execError.killed && execError.signal === 'SIGTERM';

    return NextResponse.json({
      success: false,
      error: isTimeout
        ? `Execution timed out after ${TIMEOUT_MS / 1000}s`
        : formatBuilderStorageError(error),
      stdout: execError.stdout?.trim() || '',
      stderr: execError.stderr?.trim() || '',
      code: execError.code || (isTimeout ? 'ETIMEDOUT' : 'UNKNOWN')
    }, { status: 500 });
  }
}
