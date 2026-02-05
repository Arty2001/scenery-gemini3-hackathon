'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import debounce from 'lodash.debounce';

interface ComponentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  totalCount: number;
  filteredCount: number;
}

/**
 * ComponentFilters - Search and category filter controls for component library
 *
 * Provides debounced search input and category dropdown filter.
 * Shows count of filtered vs total components.
 */
export function ComponentFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  totalCount,
  filteredCount,
}: ComponentFiltersProps) {
  // Local state for search input (for debouncing)
  const [localSearch, setLocalSearch] = useState(search);

  // Sync local search with prop when it changes externally
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced search callback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearchChange = useCallback(
    debounce((value: string) => {
      onSearchChange(value);
    }, 300),
    [onSearchChange]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearchChange.cancel();
    };
  }, [debouncedSearchChange]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    debouncedSearchChange(value);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search components..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 sm:w-64"
          />
        </div>

        {/* Category Dropdown */}
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-48"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {formatCategoryLabel(cat)}
            </option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        {filteredCount} of {totalCount} components
      </p>
    </div>
  );
}

/**
 * Format category slug to readable label
 * e.g., "alert-dialog" -> "Alert Dialog"
 */
function formatCategoryLabel(category: string): string {
  return category
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
