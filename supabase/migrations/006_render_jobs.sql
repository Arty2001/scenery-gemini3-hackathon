-- render_jobs: Track video export render jobs
-- Supports Remotion Lambda render tracking with Realtime progress updates

-- =============================================
-- Table
-- =============================================

CREATE TABLE render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  composition_id uuid NOT NULL REFERENCES compositions(id) ON DELETE CASCADE,
  render_id text, -- Remotion Lambda render ID
  bucket_name text, -- S3 bucket name for render output
  quality text NOT NULL DEFAULT '1080p' CHECK (quality IN ('720p', '1080p', '4K')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'complete', 'failed')),
  progress real NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  output_url text, -- Final video URL (S3)
  error text, -- Error message if failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_render_jobs_user_id ON render_jobs(user_id);
CREATE INDEX idx_render_jobs_composition_id ON render_jobs(composition_id);
CREATE INDEX idx_render_jobs_status ON render_jobs(status);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own render jobs
CREATE POLICY "Users can view own render jobs"
  ON render_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own render jobs
CREATE POLICY "Users can insert own render jobs"
  ON render_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own render jobs
CREATE POLICY "Users can update own render jobs"
  ON render_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own render jobs
CREATE POLICY "Users can delete own render jobs"
  ON render_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- Realtime
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE render_jobs;

-- =============================================
-- Updated_at trigger
-- =============================================

CREATE TRIGGER set_render_jobs_updated_at
  BEFORE UPDATE ON render_jobs
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_updated_at_column();
