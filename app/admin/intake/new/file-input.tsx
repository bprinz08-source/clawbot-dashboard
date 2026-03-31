'use client';

import { MAX_INTAKE_EVIDENCE_FILE_SIZE_LABEL } from '@/app/admin/intake/new/upload-config';

type FileInputProps = {
  disabled: boolean;
};

export function FileInput({ disabled }: FileInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="evidence-file" className="text-sm font-medium text-neutral-900">
        Evidence File
      </label>
      <input
        id="evidence-file"
        name="evidence_file"
        type="file"
        required
        disabled={disabled}
        className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 disabled:file:bg-neutral-300"
      />
      <p className="text-xs text-neutral-500">
        {disabled
          ? 'Choose a project first. File upload stays locked until project selection is explicit.'
          : `Upload one evidence file to stage the initial intake item. Maximum size: ${MAX_INTAKE_EVIDENCE_FILE_SIZE_LABEL}.`}
      </p>
    </div>
  );
}
