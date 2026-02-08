-- Add content hash for incremental sync caching
-- Components with unchanged content_hash will be skipped during resync

ALTER TABLE discovered_components ADD COLUMN content_hash text;

-- Index for efficient hash lookups during sync
CREATE INDEX idx_discovered_components_content_hash
  ON discovered_components(repository_id, file_path, content_hash);

COMMENT ON COLUMN discovered_components.content_hash IS 'SHA-256 hash of source file content for incremental sync';
