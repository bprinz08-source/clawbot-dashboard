'use client';

type BuilderFiltersProps = {
  searchTerm: string;
  tierFilter: string;
  tierOptions: string[];
  onSearchTermChange: (value: string) => void;
  onTierFilterChange: (value: string) => void;
};

export default function BuilderFilters({
  searchTerm,
  tierFilter,
  tierOptions,
  onSearchTermChange,
  onTierFilterChange
}: BuilderFiltersProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Search</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Search company or city"
          autoComplete="off"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-medium">Tier</span>
        <select
          value={tierFilter}
          onChange={(event) => onTierFilterChange(event.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          {tierOptions.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'All tiers' : option}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
