-- =============================================
-- DEMO COMPOSITIONS WRITE ACCESS
-- Allow anyone to write to demo project compositions
-- =============================================

-- Policy: Anyone can insert a composition for demo projects (if none exists)
CREATE POLICY "Anyone can insert demo compositions"
  ON public.compositions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = compositions.project_id
      AND projects.is_demo = true
    )
  );

-- Policy: Anyone can update compositions for demo projects
CREATE POLICY "Anyone can update demo compositions"
  ON public.compositions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = compositions.project_id
      AND projects.is_demo = true
    )
  );
