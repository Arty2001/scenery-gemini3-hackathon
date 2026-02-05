-- =============================================
-- REPOSITORY CONNECTIONS TABLE (link GitHub repos to projects)
-- =============================================
-- Stores metadata about connected GitHub repositories.
-- One repository per project (enforced by unique constraint).
-- Clone URL is stored for server-side cloning operations.
-- =============================================

create table public.repository_connections (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  owner text not null,
  name text not null,
  full_name text generated always as (owner || '/' || name) stored,
  default_branch text not null default 'main',
  is_private boolean not null default false,
  clone_url text not null,
  local_path text, -- where repo is cloned on server
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(project_id) -- one repo per project
);

-- Enable RLS
alter table public.repository_connections enable row level security;

-- Policy: Users can manage connections for their own projects
create policy "Users can manage own repository connections"
  on public.repository_connections for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Index for faster project lookups
create index repo_connections_project_id_idx on public.repository_connections(project_id);

-- Trigger for updated_at (uses existing function from 001)
create trigger repo_connections_updated_at
  before update on public.repository_connections
  for each row execute procedure public.update_updated_at_column();
