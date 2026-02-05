-- Create project-assets storage bucket for user media uploads.
-- Public bucket so Remotion can access URLs during rendering.
-- RLS policies control who can upload/delete.

INSERT INTO storage.buckets (id, name, public) VALUES ('project-assets', 'project-assets', true);

-- Allow authenticated users to upload to their project paths
CREATE POLICY "Users can upload project assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-assets');

-- Allow authenticated users to read project assets
CREATE POLICY "Users can read project assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-assets');

-- Allow authenticated users to delete their project assets
CREATE POLICY "Users can delete project assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-assets');
