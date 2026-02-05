-- =============================================
-- COMPOSITIONS TABLE (video composition timeline data)
-- =============================================
-- Stores video composition data for Remotion-based rendering.
-- Each project has one composition (for now - enforced via unique constraint).
-- Tracks are stored as JSONB containing multi-track timeline items.
-- Items can reference discovered_components for user's React components.
-- =============================================

create table public.compositions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null default 'Untitled Composition',
  tracks jsonb not null default '[]',
  duration_in_frames integer not null default 300,
  fps integer not null default 30,
  width integer not null default 1920,
  height integer not null default 1080,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One composition per project for now
  unique(project_id)
);

-- Enable RLS
alter table public.compositions enable row level security;

-- Policy: Users can manage compositions in their own projects
create policy "Users can manage compositions in own projects"
  on public.compositions for all
  using (
    project_id in (
      select id from public.projects
      where user_id = auth.uid()
    )
  );

-- Index for fast project lookups
create index compositions_project_id_idx on public.compositions(project_id);

-- Trigger for updated_at (uses existing function from 001)
create trigger compositions_updated_at
  before update on public.compositions
  for each row execute procedure public.update_updated_at_column();
