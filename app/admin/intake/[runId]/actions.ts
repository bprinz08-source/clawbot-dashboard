'use server';

import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { redirect, unstable_rethrow } from 'next/navigation';
import type { ManualLinkSearchState } from '@/app/admin/intake/[runId]/manual-link-search-state';

const execFileAsync = promisify(execFile);

type ParseCsvSummary = {
  source_intake_item_id: string;
  intake_run_id: string;
  rows_parsed: number;
  staged_durable_candidates_created: number;
  skipped_rows: number;
};

type PromoteSafeProductsSummary = {
  intake_run_id: string;
  project_id: string;
  eligible_staged_rows: number;
  product_instances_created: number;
  linked_to_existing_product_instances: number;
  staged_rows_imported: number;
  skipped_rows: number;
};

type ManualLinkSearchSummary = {
  product: {
    brand: string;
    category: string;
    model: string;
    title: string;
  };
  queries: string[];
  candidates: Array<{
    query: string;
    source_label: string;
    title: string;
    url: string;
  }>;
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

export async function promoteSafeProductsAction(formData: FormData) {
  const runId = getString(formData, 'run_id');

  if (!runId) {
    redirect('/admin/intake?error=Missing%20intake%20run%20id.');
  }

  try {
    const { stdout } = await execFileAsync(
      'python3',
      [join(process.cwd(), 'scripts', 'promote_safe_intake_run_products.py'), runId],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024
      }
    );

    const summary = JSON.parse(stdout) as PromoteSafeProductsSummary;
    const message =
      `Imported ${summary.staged_rows_imported} safe staged products. ` +
      `Created ${summary.product_instances_created} live product records and linked ${summary.linked_to_existing_product_instances} existing matches.`;

    redirect(`/admin/intake/${runId}?message=${encodeURIComponent(message)}`);
  } catch (error) {
    unstable_rethrow(error);

    const message =
      error instanceof Error ? error.message : 'Failed to promote safe staged products.';

    redirect(`/admin/intake/${runId}?error=${encodeURIComponent(message)}`);
  }
}

export async function findManualLinksAction(
  _previousState: ManualLinkSearchState,
  formData: FormData
): Promise<ManualLinkSearchState> {
  const intakeItemId = getString(formData, 'intake_item_id');

  if (!intakeItemId) {
    return {
      error: 'Missing intake item id.',
      product: null,
      queries: [],
      candidates: []
    };
  }

  try {
    const { stdout } = await execFileAsync(
      'python3',
      [join(process.cwd(), 'scripts', 'find_manual_links_for_intake_item.py'), intakeItemId],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024
      }
    );

    const summary = JSON.parse(stdout) as ManualLinkSearchSummary;

    return {
      error: null,
      product: summary.product,
      queries: summary.queries,
      candidates: summary.candidates
    };
  } catch (error) {
    unstable_rethrow(error);

    return {
      error: error instanceof Error ? error.message : 'Failed to find manual links.',
      product: null,
      queries: [],
      candidates: []
    };
  }
}
