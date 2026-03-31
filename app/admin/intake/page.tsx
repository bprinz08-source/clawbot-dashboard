import Link from 'next/link';
import { formatDateTime, getIntakeRuns } from '@/app/admin/intake/_lib/intake';

export const dynamic = 'force-dynamic';

function statusPillClass(status: string) {
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

export default async function IntakeRunsPage() {
  const { runs, error } = await getIntakeRuns();

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
                Admin Intake
              </p>
              <h1 className="text-3xl font-semibold text-neutral-950">Intake Inspector</h1>
              <p className="max-w-3xl text-sm text-neutral-600">
                Read-only visibility into staged intake runs and import progress.
              </p>
            </div>

            <Link
              href="/admin/intake/new"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              New Intake Submission
            </Link>
          </div>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">Recent Intake Runs</h2>
              <p className="text-sm text-neutral-500">{runs.length} runs loaded</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  {[
                    'Source Label',
                    'Builder',
                    'Project ID',
                    'Status',
                    'Created',
                    'Updated',
                    'Item Count',
                    'Imported',
                    'Unresolved'
                  ].map((label) => (
                    <th
                      key={label}
                      className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-600"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                      No intake runs found.
                    </td>
                  </tr>
                ) : (
                  runs.map((entry) => (
                    <tr
                      key={entry.run.id}
                      className="border-t border-neutral-200 align-top transition hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/intake/${entry.run.id}`}
                          className="font-medium text-neutral-950 underline-offset-2 hover:underline"
                        >
                          {entry.run.source_label || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {entry.run.builder_name || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                        {entry.run.project_id || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass(entry.run.status)}`}
                        >
                          {entry.run.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDateTime(entry.run.created_at)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDateTime(entry.run.updated_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-950">{entry.itemCount}</td>
                      <td className="px-4 py-3 text-emerald-700">{entry.importedItemCount}</td>
                      <td className="px-4 py-3 text-amber-700">{entry.unresolvedItemCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
