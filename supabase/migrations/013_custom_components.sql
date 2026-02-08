-- =============================================
-- CUSTOM COMPONENTS TABLE (User-imported HTML snippets)
-- =============================================
-- Stores HTML components that users paste from external websites.
-- AI processes the HTML to make it self-contained and categorizes it.
-- These can be used in the video editor just like discovered components.
-- =============================================

create table public.custom_components (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  description text,
  category text,
  original_html text not null,
  preview_html text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.custom_components enable row level security;

-- Policy: Users can manage custom components in their own projects
create policy "Users can manage custom components in own projects"
  on public.custom_components for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Policy: Anyone can read custom components in demo projects
create policy "Anyone can read custom components in demo projects"
  on public.custom_components for select
  using (
    project_id in (
      select id from public.projects where is_demo = true
    )
  );

-- Index for fast project lookups
create index custom_components_project_id_idx on public.custom_components(project_id);

-- Index for category filtering
create index custom_components_category_idx on public.custom_components(category);

-- Trigger for updated_at
create trigger custom_components_updated_at
  before update on public.custom_components
  for each row execute procedure public.update_updated_at_column();
