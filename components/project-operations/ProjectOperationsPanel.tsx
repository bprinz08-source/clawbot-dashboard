import type { ProjectOperationsSummary } from '../../lib/types/project-operations';

type Props = {
  projectIds: string[];
  selectedProjectId: string;
  summary: ProjectOperationsSummary;
};

const plannedActions = [
  'Validate import readiness',
  'Run non-prod import',
  'Apply product polish',
  'Apply metadata fill',
  'Run maintenance writer',
];

function renderUnknown(label = 'Unknown (not yet instrumented)') {
  return label;
}

function renderCount(value: number | null) {
  return value ?? renderUnknown();
}

function renderArtifactRefs(artifactRefs: string[]) {
  if (artifactRefs.length === 0) {
    return renderUnknown();
  }

  return artifactRefs.join(', ');
}

export function ProjectOperationsPanel({ projectIds, selectedProjectId, summary }: Props) {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Project Operations Panel (Read-Only v1.1)</h1>
      <p>Internal-only status surface. Actions remain upcoming and disabled in this version.</p>

      <section style={{ marginTop: 16 }}>
        <form method="get">
          <label htmlFor="project-select">Project selector:</label>{' '}
          <select id="project-select" name="project_id" defaultValue={selectedProjectId}>
            {projectIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>{' '}
          <button type="submit">View project</button>
        </form>
        <small style={{ display: 'block', marginTop: 6 }}>
          Project selection is URL-driven and restricted to the non-prod allowlist.
        </small>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Status Cards</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))' }}>
          {summary.workflows.map((workflow) => (
            <article key={workflow.workflow_key} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>{workflow.workflow_key}</h3>
              <p>Project: {summary.projectId}</p>
              <p>Status: {workflow.last_run_status ?? renderUnknown()}</p>
              <p>Last run: {workflow.last_run_at ?? renderUnknown()}</p>
              <p>Run mode: {workflow.last_run_mode ?? renderUnknown()}</p>
              <p>
                Latest error summary: {workflow.latest_error_summary ?? renderUnknown()}
              </p>
              <p>Latest error code: {workflow.latest_error_code ?? renderUnknown()}</p>
              <p>Counts: {workflow.counts_json ? JSON.stringify(workflow.counts_json) : renderUnknown()}</p>
              <p>Artifacts: {renderArtifactRefs(workflow.artifact_refs)}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Unresolved / Review Queue Summary</h2>
        <ul>
          <li>Unresolved or failed docs: {renderCount(summary.unresolvedCount)}</li>
          <li>Review-needed items: {renderCount(summary.reviewNeededCount)}</li>
        </ul>
        <h3>Top blockers</h3>
        <ul>
          {summary.topBlockers === null ? <li>{renderUnknown()}</li> : null}
          {summary.topBlockers?.length === 0 ? <li>No blockers reported.</li> : null}
          {summary.topBlockers?.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Planned Actions (Upcoming)</h2>
        <p>Disabled in read-only v1. No execution wiring is present.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {plannedActions.map((action) => (
            <button key={action} disabled aria-disabled="true" title="Upcoming (not enabled in read-only v1)">
              {action}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
