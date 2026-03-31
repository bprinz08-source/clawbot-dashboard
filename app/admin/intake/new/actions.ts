'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import {
  createIntakeItem,
  createIntakeRun,
  getProjectById,
  stageIntakeEvidenceUpload
} from '@/app/admin/intake/_lib/intake';
import type { IntakeSubmissionState } from '@/app/admin/intake/new/form-state';
import { MAX_INTAKE_EVIDENCE_FILE_SIZE_BYTES } from '@/app/admin/intake/new/upload-config';

function getTrimmedString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function inferItemKind(mimeType: string, fileName: string) {
  const normalizedMimeType = mimeType.toLowerCase();
  const normalizedName = fileName.toLowerCase();

  if (normalizedMimeType.startsWith('image/')) {
    return 'image';
  }

  if (
    normalizedMimeType.includes('pdf') ||
    normalizedMimeType.includes('sheet') ||
    normalizedMimeType.includes('spreadsheet') ||
    normalizedMimeType.includes('csv') ||
    normalizedName.endsWith('.pdf') ||
    normalizedName.endsWith('.csv') ||
    normalizedName.endsWith('.xls') ||
    normalizedName.endsWith('.xlsx')
  ) {
    return 'document';
  }

  return 'file';
}

export async function submitIntakeRun(
  _previousState: IntakeSubmissionState,
  formData: FormData
): Promise<IntakeSubmissionState> {
  try {
    const projectId = getTrimmedString(formData, 'project_id');
    const sourceLabel = getTrimmedString(formData, 'source_label');
    const builderName = getTrimmedString(formData, 'builder_name');
    const sourceIdentifier = getTrimmedString(formData, 'source_identifier');
    const notes = getTrimmedString(formData, 'notes');
    const fileEntry = formData.get('evidence_file');

    if (!projectId) {
      return {
        error: 'Select a project before uploading evidence.'
      };
    }

    if (!sourceLabel) {
      return {
        error: 'Source label is required.'
      };
    }

    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      return {
        error: 'Upload one evidence file.'
      };
    }

    if (fileEntry.size > MAX_INTAKE_EVIDENCE_FILE_SIZE_BYTES) {
      return {
        error: 'The selected file is too large for this intake upload.'
      };
    }

    const project = await getProjectById(projectId);

    if (!project) {
      return {
        error: 'Selected project was not found.'
      };
    }

    const storagePath = await stageIntakeEvidenceUpload(fileEntry, project.id);
    const run = await createIntakeRun({
      projectId: project.id,
      sourceLabel,
      builderName,
      sourceIdentifier,
      notes
    });

    await createIntakeItem({
      intakeRunId: run.id,
      sourceFileName: fileEntry.name || 'upload',
      storagePath,
      mimeType: fileEntry.type || 'application/octet-stream',
      fileSizeBytes: Number.isFinite(fileEntry.size) ? fileEntry.size : null,
      itemKind: inferItemKind(fileEntry.type, fileEntry.name)
    });

    redirect(`/admin/intake/${run.id}`);
  } catch (error) {
    unstable_rethrow(error);

    return {
      error: error instanceof Error ? error.message : 'Failed to create the intake submission.'
    };
  }
}
