-- Add interactive_elements column to store structured info about clickable/interactive elements
-- This enables better cursor interaction targeting in tutorials

ALTER TABLE discovered_components
ADD COLUMN IF NOT EXISTS interactive_elements JSONB DEFAULT '[]'::jsonb;

-- Add index for querying components with interactive elements
CREATE INDEX IF NOT EXISTS idx_discovered_components_has_interactives
ON discovered_components ((jsonb_array_length(interactive_elements) > 0));

COMMENT ON COLUMN discovered_components.interactive_elements IS
'Array of interactive elements found in the component preview HTML. Each element contains: tag, selector, label, type, name, placeholder, etc.';
