'use client';

import { useActionState, useState } from 'react';
import type { ProjectRecord } from '@/app/admin/intake/_lib/intake';
import {
  initialIntakeSubmissionState,
  submitIntakeRun
} from '@/app/admin/intake/new/actions';
import { FileInput } from '@/app/admin/intake/new/file-input';
import { ProjectPicker } from '@/app/admin/intake/new/project-picker';
import {
  MAX_INTAKE_EVIDENCE_FILE_SIZE_BYTES,
  MAX_INTAKE_EVIDENCE_FILE_SIZE_LABEL
} from '@/app/admin/intake/new/upload-config';

type SubmitFormProps = {
  projects: ProjectRecord[];
  initialProjectId?: string;
  initialError?: string | null;
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300"
    >
      {pending ? 'Creating Intake Run...' : 'Create Intake Run'}
    </button>
  );
}

export function IntakeSubmissionForm({
  projects,
  initialProjectId = '',
  initialError = null
}: SubmitFormProps) {
  const [state, formAction, pending] = useActionState(submitIntakeRun, {
    ...initialIntakeSubmissionState,
    error: initialError
  });
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [clientError, setClientError] = useState<string | null>(null);
  const hasProjectSelection = Boolean(selectedProjectId);
  const formError = clientError ?? state.error;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const fileEntry = formData.get('evidence_file');

    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      setClientError(null);
      return;
    }

    if (fileEntry.size > MAX_INTAKE_EVIDENCE_FILE_SIZE_BYTES) {
      event.preventDefault();
      setClientError(
        `This file exceeds the ${MAX_INTAKE_EVIDENCE_FILE_SIZE_LABEL} upload limit for intake evidence.`
      );
      return;
    }

    setClientError(null);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <ProjectPicker
        projects={projects}
        initialProjectId={initialProjectId}
        onProjectSelectionChange={setSelectedProjectId}
      />

      {formError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="source-label" className="text-sm font-medium text-neutral-900">
            Source Label
          </label>
          <input
            id="source-label"
            name="source_label"
            type="text"
            required
            placeholder="Builder handoff March 30"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="builder-name" className="text-sm font-medium text-neutral-900">
            Builder Name
          </label>
          <input
            id="builder-name"
            name="builder_name"
            type="text"
            placeholder="Optional"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="source-identifier" className="text-sm font-medium text-neutral-900">
            Source Identifier
          </label>
          <input
            id="source-identifier"
            name="source_identifier"
            type="text"
            placeholder="Optional external ID"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          />
        </div>
      </div>

      <FileInput disabled={!hasProjectSelection} />

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-900">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder="Optional operator notes"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <p className="text-xs text-neutral-500">
          This creates one locked intake run and one initial staged item. No parsing or import runs yet.
        </p>
        <SubmitButton pending={pending} />
      </div>
    </form>
  );
}
