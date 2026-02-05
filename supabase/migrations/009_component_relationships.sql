-- Add component relationship columns for better AI understanding
-- These help the video editor AI know how components work together

ALTER TABLE discovered_components
ADD COLUMN IF NOT EXISTS uses_components TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS used_by_components TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS related_components TEXT[] DEFAULT '{}';

-- Index for finding components that use a specific component
CREATE INDEX IF NOT EXISTS idx_discovered_components_uses
ON discovered_components USING GIN (uses_components);

COMMENT ON COLUMN discovered_components.uses_components IS
'Array of component names that this component imports/uses';

COMMENT ON COLUMN discovered_components.used_by_components IS
'Array of component names that import/use this component';

COMMENT ON COLUMN discovered_components.related_components IS
'Array of component names in the same file or directory';
