-- =============================================
-- GITHUB TOKENS TABLE (store OAuth provider tokens)
-- =============================================
-- Supabase does NOT store provider_token - it's only available
-- immediately after exchangeCodeForSession. We capture and store
-- it here for subsequent GitHub API calls.
-- =============================================

create table public.github_tokens (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  access_token text not null,
  refresh_token text,
  scopes text[], -- store granted scopes for reference
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.github_tokens enable row level security;

-- Policy: Users can only access own token
create policy "Users can manage own GitHub token"
  on public.github_tokens for all
  using (auth.uid() = user_id);

-- Trigger for updated_at (uses existing function from 001)
create trigger github_tokens_updated_at
  before update on public.github_tokens
  for each row execute procedure public.update_updated_at_column();
