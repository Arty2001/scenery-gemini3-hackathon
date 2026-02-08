-- Add AI model selection to projects table
-- Users can choose which Gemini model to use for their project

ALTER TABLE projects ADD COLUMN ai_model text DEFAULT 'gemini-3-pro-preview';

-- Add comment for documentation
COMMENT ON COLUMN projects.ai_model IS 'Selected Gemini model for AI operations (gemini-3-pro-preview, gemini-3-flash-preview)';
