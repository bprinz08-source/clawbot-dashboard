'use client';

import { useActionState } from 'react';
import { stageManualLinkAction } from '@/app/admin/intake/[runId]/actions';
import {
  initialManualLinkStageResult,
  type ManualLinkCandidate,
  type ManualLinkStageResult
} from '@/app/admin/intake/[runId]/manual-link-search-state';

type ManualLinkStageButtonProps = {
  candidate: ManualLinkCandidate;
  intakeItemId: string;
};

export function ManualLinkStageButton({
  candidate,
  intakeItemId
}: ManualLinkStageButtonProps) {
  const [state, formAction, pending] = useActionState<ManualLinkStageResult, FormData>(
    stageManualLinkAction,
    initialManualLinkStageResult
  );

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="intake_item_id" value={intakeItemId} />
        <input type="hidden" name="candidate_url" value={candidate.url} />
        <input type="hidden" name="candidate_title" value={candidate.title} />
        <input type="hidden" name="source_label" value={candidate.source_label} />
        <input type="hidden" name="query" value={candidate.query} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {pending ? 'Staging...' : 'Stage Manual Link'}
        </button>
      </form>

      {state.error ? (
        <p className="text-xs text-red-700">{state.error}</p>
      ) : null}

      {state.message ? (
        <p className={`text-xs ${state.created ? 'text-emerald-700' : 'text-amber-700'}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
