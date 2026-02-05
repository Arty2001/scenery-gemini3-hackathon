-- =============================================
-- DISCOVERED COMPONENTS TABLE (React components found in repositories)
-- =============================================
-- Stores metadata about React components discovered during repository analysis.
-- Components are linked to repository connections via foreign key.
-- Multiple components per repository are supported.
-- Supports compound components via self-referential parent FK.
-- Partial analysis results can be saved using analysis_error field.
-- =============================================

create table public.discovered_components (
  id uuid default gen_random_uuid() primary key,
  repository_id uuid references public.repository_connections(id) on delete cascade not null,
  file_path text not null,
  component_name text not null,
  display_name text,
  description text,
  props_schema jsonb not null default '{}',
  category text,
  category_confidence numeric(3,2),
  secondary_categories text[],
  demo_props jsonb,
  demo_props_confidence text check (demo_props_confidence in ('high', 'medium', 'low')),
  is_compound_child boolean default false,
  parent_component_id uuid references public.discovered_components(id) on delete set null,
  analysis_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(repository_id, file_path, component_name)
);

-- Enable RLS
alter table public.discovered_components enable row level security;

-- Policy: Users can access components in their own repositories (via project ownership)
create policy "Users can manage components in own repositories"
  on public.discovered_components for all
  using (
    repository_id in (
      select rc.id from public.repository_connections rc
      inner join public.projects p on rc.project_id = p.id
      where p.user_id = auth.uid()
    )
  );

-- Index for fast repository lookups
create index discovered_components_repository_id_idx on public.discovered_components(repository_id);

-- Index for category filtering
create index discovered_components_category_idx on public.discovered_components(category);

-- Index for parent component lookups (compound components)
create index discovered_components_parent_id_idx on public.discovered_components(parent_component_id);

-- Trigger for updated_at (uses existing function from 001)
create trigger discovered_components_updated_at
  before update on public.discovered_components
  for each row execute procedure public.update_updated_at_column();
