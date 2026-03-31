'use client';

import { useActionState } from 'react';
import { downloadStoreManualAction } from '@/app/admin/intake/[runId]/actions';
import {
  initialDownloadStoreManualResult,
  type DownloadStoreManualResult
} from '@/app/admin/intake/[runId]/manual-link-search-state';

type DownloadStoreManualButtonProps = {
  intakeItemId: string;
};

export function DownloadStoreManualButton({
  intakeItemId
}: DownloadStoreManualButtonProps) {
  const [state, formAction, pending] = useActionState<DownloadStoreManualResult, FormData>(
    downloadStoreManualAction,
    initialDownloadStoreManualResult
  );

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="intake_item_id" value={intakeItemId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {pending ? 'Downloading...' : 'Download + Store Manual'}
        </button>
      </form>

      {state.error ? (
        <p className="text-xs text-red-700">{state.error}</p>
      ) : null}

      {state.message ? (
        <div className="space-y-1 text-xs text-emerald-700">
          <p>{state.message}</p>
          {state.file_name ? <p>{state.file_name}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
