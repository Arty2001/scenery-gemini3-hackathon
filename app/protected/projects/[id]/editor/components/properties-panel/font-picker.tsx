'use client';

/**
 * Google Font picker using @remotion/google-fonts.
 * Displays a searchable dropdown of all available Google Fonts.
 */

import { useState, useMemo } from 'react';
import { getAvailableFonts } from '@remotion/google-fonts';
import { Label } from '@/components/ui/label';

// =============================================
// Types
// =============================================

interface FontPickerProps {
  value: string;
  onChange: (fontFamily: string) => void;
}

// =============================================
// Font Data (computed once at module level)
// =============================================

const ALL_FONTS = getAvailableFonts();

// =============================================
// Component
// =============================================

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [search, setSearch] = useState('');

  const filteredFonts = useMemo(() => {
    if (!search) return ALL_FONTS;
    const lower = search.toLowerCase();
    return ALL_FONTS.filter((f) => f.fontFamily.toLowerCase().includes(lower));
  }, [search]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Font Family</Label>
      <input
        type="text"
        className="w-full h-7 text-xs rounded-md border bg-background px-2"
        placeholder="Search fonts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        className="w-full h-7 text-xs rounded-md border bg-background px-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {filteredFonts.map((f) => (
          <option key={f.importName} value={f.fontFamily}>
            {f.fontFamily}
          </option>
        ))}
      </select>
    </div>
  );
}
