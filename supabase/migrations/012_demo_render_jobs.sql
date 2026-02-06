-- =============================================
-- DEMO RENDER JOBS SUPPORT
-- Allow anonymous users to export demo project compositions
-- =============================================

-- Make user_id nullable (for demo project exports without auth)
ALTER TABLE render_jobs ALTER COLUMN user_id DROP NOT NULL;

-- Policy: Anyone can insert render jobs for demo project compositions
CREATE POLICY "Anyone can insert demo render jobs"
  ON render_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compositions c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = render_jobs.composition_id
      AND p.is_demo = true
    )
  );

-- Policy: Anyone can view render jobs for demo project compositions
CREATE POLICY "Anyone can view demo render jobs"
  ON render_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM compositions c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = render_jobs.composition_id
      AND p.is_demo = true
    )
  );

-- Policy: Anyone can update render jobs for demo project compositions (for progress polling)
CREATE POLICY "Anyone can update demo render jobs"
  ON render_jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM compositions c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = render_jobs.composition_id
      AND p.is_demo = true
    )
  );
