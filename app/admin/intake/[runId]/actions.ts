'use server';

import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { redirect, unstable_rethrow } from 'next/navigation';

const execFileAsync = promisify(execFile);

type ParseCsvSummary = {
  source_intake_item_id: string;
  intake_run_id: string;
  rows_parsed: number;
  staged_durable_candidates_created: number;
  skipped_rows: number;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function parseCsvEvidenceAction(formData: FormData) {
  const runId = getString(formData, 'run_id');
  const sourceIntakeItemId = getString(formData, 'source_intake_item_id');

  if (!runId) {
    redirect('/admin/intake?error=Missing%20intake%20run%20id.');
  }

  if (!sourceIntakeItemId) {
    redirect(`/admin/intake/${runId}?error=${encodeURIComponent('Missing CSV source intake item.')}`);
  }

  try {
    const { stdout } = await execFileAsync(
      'python3',
      [join(process.cwd(), 'scripts', 'explode_csv_intake_item_to_staged_rows.py'), sourceIntakeItemId],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024
      }
    );

    const summary = JSON.parse(stdout) as ParseCsvSummary;
    const message = `Parsed ${summary.rows_parsed} CSV rows and created ${summary.staged_durable_candidates_created} staged durable candidates.`;

    redirect(`/admin/intake/${runId}?message=${encodeURIComponent(message)}`);
  } catch (error) {
    unstable_rethrow(error);

    const message =
      error instanceof Error ? error.message : 'Failed to parse the uploaded CSV evidence.';

    redirect(`/admin/intake/${runId}?error=${encodeURIComponent(message)}`);
  }
}
