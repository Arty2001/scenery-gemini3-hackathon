-- =============================================
-- DEMO PROJECTS SUPPORT
-- Allow anonymous users to read demo projects
-- =============================================

-- Add is_demo column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

-- Create index for faster demo project queries
CREATE INDEX IF NOT EXISTS projects_is_demo_idx ON public.projects(is_demo) WHERE is_demo = true;

-- Policy: Anyone can read demo projects (even anonymous users)
CREATE POLICY "Anyone can read demo projects"
  ON public.projects FOR SELECT
  USING (is_demo = true);

-- Also allow anonymous read of repository_connections for demo projects
CREATE POLICY "Anyone can read demo repository connections"
  ON public.repository_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = repository_connections.project_id
      AND projects.is_demo = true
    )
  );

-- Also allow anonymous read of discovered_components for demo projects
CREATE POLICY "Anyone can read demo components"
  ON public.discovered_components FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.repository_connections rc
      JOIN public.projects p ON p.id = rc.project_id
      WHERE rc.id = discovered_components.repository_id
      AND p.is_demo = true
    )
  );

-- Also allow anonymous read of compositions for demo projects
CREATE POLICY "Anyone can read demo compositions"
  ON public.compositions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = compositions.project_id
      AND projects.is_demo = true
    )
  );
