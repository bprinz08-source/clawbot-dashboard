import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ManualLinkSearch } from '@/app/admin/intake/[runId]/manual-link-search';
import {
  parseCsvEvidenceAction,
  promoteSafeProductsAction
} from '@/app/admin/intake/[runId]/actions';
import {
  formatCell,
  formatConfidence,
  formatDateTime,
  getIntakeRunDetail,
  isImportedItem
} from '@/app/admin/intake/_lib/intake';

export const dynamic = 'force-dynamic';

const ITEM_COLUMNS: Array<{
  key:
    | 'source_file_name'
    | 'item_kind'
    | 'proposed_document_type'
    | 'proposed_category'
    | 'proposed_room_id'
    | 'room_match_confidence'
    | 'title'
    | 'brand'
    | 'model_number'
    | 'serial_number'
    | 'review_status'
    | 'original_file_hash'
    | 'import_target_type'
    | 'import_target_id'
    | 'imported_at'
    | 'actions';
  label: string;
}> = [
  { key: 'source_file_name', label: 'Source File' },
  { key: 'item_kind', label: 'Kind' },
  { key: 'proposed_document_type', label: 'Doc Type' },
  { key: 'proposed_category', label: 'Category' },
  { key: 'proposed_room_id', label: 'Room ID' },
  { key: 'room_match_confidence', label: 'Room Match' },
  { key: 'title', label: 'Title' },
  { key: 'brand', label: 'Brand' },
  { key: 'model_number', label: 'Model' },
  { key: 'serial_number', label: 'Serial' },
  { key: 'review_status', label: 'Review' },
  { key: 'original_file_hash', label: 'File Hash' },
  { key: 'import_target_type', label: 'Target Type' },
  { key: 'import_target_id', label: 'Target ID' },
  { key: 'imported_at', label: 'Imported At' },
  { key: 'actions', label: 'Actions' }
];

function runStatusPillClass(status: string) {
  switch (status) {
    case 'imported':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'needs_review':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'processing':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-700';
  }
}

function itemToneClass(isImported: boolean) {
  return isImported
    ? 'bg-emerald-50/70'
    : 'bg-amber-50/70';
}

function isCsvSourceItem(item: Record<string, unknown>) {
  const sourceFileName = typeof item.source_file_name === 'string' ? item.source_file_name.toLowerCase() : '';
  const mimeType = typeof item.mime_type === 'string' ? item.mime_type.toLowerCase() : '';
  const storagePath = typeof item.storage_path === 'string' ? item.storage_path.toLowerCase() : '';

  return Boolean(storagePath) && (
    sourceFileName.endsWith('.csv') ||
    mimeType.includes('csv') ||
    storagePath.endsWith('.csv')
  );
}

function isSafePromotableItem(item: Record<string, unknown>) {
  const itemKind = typeof item.item_kind === 'string' ? item.item_kind : '';
  const reviewStatus = typeof item.review_status === 'string' ? item.review_status : '';
  const proposedCategory = typeof item.proposed_category === 'string' ? item.proposed_category.trim() : '';
  const brand = typeof item.brand === 'string' ? item.brand.trim() : '';
  const modelNumber = typeof item.model_number === 'string' ? item.model_number.trim() : '';
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const importedAt = typeof item.imported_at === 'string' ? item.imported_at.trim() : '';
  const importTargetId = typeof item.import_target_id === 'string' ? item.import_target_id.trim() : '';

  return (
    itemKind === 'other' &&
    reviewStatus === 'unreviewed' &&
    Boolean(proposedCategory) &&
    Boolean(brand) &&
    Boolean(modelNumber) &&
    Boolean(title) &&
    title.toLowerCase() !== 'master shower' &&
    !importedAt &&
    !importTargetId
  );
}

function canFindManualLinks(item: Record<string, unknown>) {
  const importTargetType = typeof item.import_target_type === 'string' ? item.import_target_type.trim() : '';
  const importTargetId = typeof item.import_target_id === 'string' ? item.import_target_id.trim() : '';
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const brand = typeof item.brand === 'string' ? item.brand.trim() : '';
  const modelNumber = typeof item.model_number === 'string' ? item.model_number.trim() : '';

  return (
    importTargetType === 'product_instance' &&
    Boolean(importTargetId) &&
    Boolean(title) &&
    Boolean(brand) &&
    Boolean(modelNumber)
  );
}

export default async function IntakeRunDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { runId } = await params;
  const { error: actionError, message } = await searchParams;
  const { run, items, error } = await getIntakeRunDetail(runId);

  if (!run && !error) {
    notFound();
  }

  const importedCount = items.filter(isImportedItem).length;
  const unresolvedCount = items.length - importedCount;
  const csvSourceItem = items.find((item) => isCsvSourceItem(item as Record<string, unknown>));
  const hasSafePromotableItems = items.some((item) => isSafePromotableItem(item as Record<string, unknown>));

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/admin/intake"
              className="text-sm font-medium text-neutral-600 underline-offset-2 hover:underline"
            >
              Back to Intake Runs
            </Link>
            <h1 className="text-3xl font-semibold text-neutral-950">Intake Run Detail</h1>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {run ? (
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Run Header
                  </p>
                  <h2 className="text-2xl font-semibold text-neutral-950">
                    {run.source_label || 'Unnamed intake run'}
                  </h2>
                </div>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${runStatusPillClass(run.status)}`}
                >
                  {run.status || 'unknown'}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Builder
                  </p>
                  <p className="mt-2 text-sm text-neutral-900">{run.builder_name || '—'}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Project ID
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-neutral-900">
                    {run.project_id || '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Items
                  </p>
                  <p className="mt-2 text-sm text-neutral-900">
                    {items.length} total, {importedCount} imported, {unresolvedCount} unresolved
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Created
                  </p>
                  <p className="mt-2 text-sm text-neutral-900">{formatDateTime(run.created_at)}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Updated
                  </p>
                  <p className="mt-2 text-sm text-neutral-900">{formatDateTime(run.updated_at)}</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {run && csvSourceItem ? (
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-neutral-950">Processing</h2>
                <p className="text-sm text-neutral-600">
                  Run the next controlled dashboard steps without leaving the intake inspector.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <form action={parseCsvEvidenceAction}>
                  <input type="hidden" name="run_id" value={run.id} />
                  <input type="hidden" name="source_intake_item_id" value={csvSourceItem.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                  >
                    Parse CSV
                  </button>
                </form>
                {hasSafePromotableItems ? (
                  <form action={promoteSafeProductsAction}>
                    <input type="hidden" name="run_id" value={run.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                    >
                      Promote Safe Products
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">Staged Items</h2>
              <p className="text-sm text-neutral-500">
                Imported rows are shaded green. Unresolved rows are shaded amber.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-600">
                    State
                  </th>
                  {ITEM_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-600"
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-600">
                    Raw AI Output
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={ITEM_COLUMNS.length + 2} className="px-4 py-8 text-center text-neutral-500">
                      No intake items found for this run.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const imported = isImportedItem(item);

                    return (
                      <tr
                        key={item.id}
                        className={`border-t border-neutral-200 align-top ${itemToneClass(imported)}`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                              imported
                                ? 'border-emerald-200 bg-white text-emerald-700'
                                : 'border-amber-200 bg-white text-amber-700'
                            }`}
                          >
                            {imported ? 'Imported' : 'Unresolved'}
                          </span>
                        </td>
                        {ITEM_COLUMNS.map((column) => (
                          <td key={column.key} className="px-4 py-3 text-neutral-700">
                            {column.key === 'actions'
                              ? canFindManualLinks(item as Record<string, unknown>)
                                ? <ManualLinkSearch intakeItemId={item.id} />
                                : '—'
                              : column.key === 'room_match_confidence'
                              ? formatConfidence(item.room_match_confidence)
                              : column.key === 'imported_at'
                                ? formatDateTime(item.imported_at)
                                : formatCell(item[column.key])}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-neutral-700">
                          {item.raw_ai_output ? (
                            <details className="max-w-md">
                              <summary className="cursor-pointer font-medium text-neutral-900">
                                View JSON
                              </summary>
                              <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-3 text-xs text-neutral-100">
                                {JSON.stringify(item.raw_ai_output, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
