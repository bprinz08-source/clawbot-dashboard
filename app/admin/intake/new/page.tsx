import Link from 'next/link';
import { IntakeSubmissionForm } from '@/app/admin/intake/new/submit-form';
import { getProjects } from '@/app/admin/intake/_lib/intake';

export const dynamic = 'force-dynamic';

export default async function NewIntakeRunPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; project_id?: string }>;
}) {
  const [{ error: searchError, project_id: initialProjectId }, { projects, error }] = await Promise.all([
    searchParams,
    getProjects()
  ]);

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/admin/intake"
              className="text-sm font-medium text-neutral-600 underline-offset-2 hover:underline"
            >
              Back to Intake Runs
            </Link>
            <h1 className="text-3xl font-semibold text-neutral-950">New Intake Submission</h1>
            <p className="max-w-3xl text-sm text-neutral-600">
              Create one project-locked intake run from a single evidence file, then continue in the inspector.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Rule
              </p>
              <p className="mt-2 text-sm text-neutral-900">
                Project selection is required before file upload.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Scope
              </p>
              <p className="mt-2 text-sm text-neutral-900">
                One file, one intake run, one initial staged item.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Projects
              </p>
              <p className="mt-2 text-sm text-neutral-900">{projects.length} available</p>
            </div>
          </div>

          <IntakeSubmissionForm
            projects={projects}
            initialProjectId={initialProjectId}
            initialError={searchError ?? null}
          />
        </section>
      </div>
    </main>
  );
}
