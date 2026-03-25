'use client';

import { SUPPORT_STATUSES, type SupportStatus } from '@/lib/support-operator-shared';

type SupportFiltersProps = {
  searchTerm: string;
  statusFilter: 'all' | SupportStatus;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: 'all' | SupportStatus) => void;
};

export default function SupportFilters({
  searchTerm,
  statusFilter,
  onSearchTermChange,
  onStatusFilterChange
}: SupportFiltersProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Search</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Search customer or subject"
          autoComplete="off"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Status</span>
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as 'all' | SupportStatus)
          }
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <option value="all">All statuses</option>
          {SUPPORT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
