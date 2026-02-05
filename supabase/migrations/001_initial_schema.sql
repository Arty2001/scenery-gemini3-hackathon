-- =============================================
-- PROFILES TABLE (synced from auth.users)
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policy: Users can read own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Policy: Users can update own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger function to create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Create trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- PROJECTS TABLE
-- =============================================
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  repo_url text,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.projects enable row level security;

-- Policy: Users can CRUD own projects
create policy "Users can manage own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- Index for faster queries
create index projects_user_id_idx on public.projects(user_id);
create index projects_updated_at_idx on public.projects(updated_at desc);

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger for projects updated_at
create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.update_updated_at_column();

-- Trigger for profiles updated_at
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();
