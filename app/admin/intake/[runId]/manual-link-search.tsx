'use client';

import { useActionState } from 'react';
import { findManualLinksAction } from '@/app/admin/intake/[runId]/actions';
import {
  initialManualLinkSearchState,
  type ManualLinkSearchState
} from '@/app/admin/intake/[runId]/manual-link-search-state';

type ManualLinkSearchProps = {
  intakeItemId: string;
};

export function ManualLinkSearch({ intakeItemId }: ManualLinkSearchProps) {
  const [state, formAction, pending] = useActionState<ManualLinkSearchState, FormData>(
    findManualLinksAction,
    initialManualLinkSearchState
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="intake_item_id" value={intakeItemId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {pending ? 'Searching...' : 'Find Manual Links'}
        </button>
      </form>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </div>
      ) : null}

      {state.product ? (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
          <div className="space-y-1">
            <p className="font-medium text-neutral-900">
              {[state.product.brand, state.product.model, state.product.title].filter(Boolean).join(' ')}
            </p>
            <p>{state.product.category || 'unknown category'}</p>
          </div>

          {state.queries.length > 0 ? (
            <div>
              <p className="font-medium text-neutral-900">Queries</p>
              <ul className="mt-1 space-y-1">
                {state.queries.map((query) => (
                  <li key={query}>{query}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.candidates.length > 0 ? (
            <div>
              <p className="font-medium text-neutral-900">Candidates</p>
              <ul className="mt-1 space-y-2">
                {state.candidates.map((candidate) => (
                  <li key={`${candidate.url}-${candidate.query}`} className="space-y-1">
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      {candidate.title}
                    </a>
                    <p>{candidate.source_label}</p>
                    <p>{candidate.query}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No candidate links found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
