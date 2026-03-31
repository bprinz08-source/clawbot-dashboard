'use client';

import { useMemo, useState } from 'react';
import type { ProjectRecord } from '@/app/admin/intake/_lib/intake';

type ProjectPickerProps = {
  projects: ProjectRecord[];
  initialProjectId?: string;
  onProjectSelectionChange?: (projectId: string) => void;
};

export function ProjectPicker({
  projects,
  initialProjectId = '',
  onProjectSelectionChange
}: ProjectPickerProps) {
  const initialProject =
    projects.find((project) => project.id === initialProjectId) ?? null;

  const [query, setQuery] = useState(initialProject?.name || '');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProject?.id || '');

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return projects.slice(0, 25);
    }

    return projects
      .filter((project) => {
        const haystack = `${project.name} ${project.id} ${project.status}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 25);
  }, [projects, query]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;

  return (
    <div className="space-y-3">
      <input type="hidden" name="project_id" value={selectedProjectId} />

      <div className="space-y-2">
        <label htmlFor="project-search" className="text-sm font-medium text-neutral-900">
          Project
        </label>
        <input
          id="project-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);

            if (selectedProject && event.target.value !== selectedProject.name) {
              setSelectedProjectId('');
              onProjectSelectionChange?.('');
            }
          }}
          placeholder="Search projects by name or ID"
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50">
        <div className="max-h-72 overflow-y-auto p-2">
          {filteredProjects.length === 0 ? (
            <p className="px-2 py-3 text-sm text-neutral-500">No matching projects found.</p>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map((project) => {
                const isSelected = project.id === selectedProjectId;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setQuery(project.name);
                      onProjectSelectionChange?.(project.id);
                    }}
                    className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left transition ${
                      isSelected
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="text-sm font-medium">{project.name}</span>
                    <span
                      className={`font-mono text-xs ${
                        isSelected ? 'text-neutral-200' : 'text-neutral-500'
                      }`}
                    >
                      {project.id}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        {selectedProject
          ? `Selected project: ${selectedProject.name}`
          : 'Select a project before choosing a file.'}
      </p>
    </div>
  );
}
