import { ProjectOperationsPanel } from '../../../components/project-operations/ProjectOperationsPanel';
import { getProjectOperationsPanelState } from '../../../lib/query/project-operations';

type PageProps = {
  searchParams: Promise<{ project_id?: string | string[] }>;
};

export default async function ProjectOperationsPage({ searchParams }: PageProps) {
  const { project_id: requestedProjectId } = await searchParams;
  const { projectIds, selectedProjectId, summary } =
    await getProjectOperationsPanelState(requestedProjectId);

  return (
    <ProjectOperationsPanel
      projectIds={projectIds}
      selectedProjectId={selectedProjectId}
      summary={summary}
    />
  );
}
