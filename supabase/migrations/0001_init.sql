-- root — companion AI schema
-- pgvector for long-term memory; RLS on every table scoped to auth.uid().

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (created by trigger on signup)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- companions: the persona(s) a user chats with
-- ---------------------------------------------------------------------------
create table public.companions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  -- jsonb: { tone, traits[], backstory, ... } drives the system prompt
  personality       jsonb not null default '{}'::jsonb,
  avatar_url        text,
  voice             text not null default 'alloy',          -- TTS voice id
  -- per-companion model override; null = use the app default (Haiku)
  model             text,
  proactive_enabled boolean not null default true,
  -- how long since last_proactive_at before a check-in is due
  proactive_cadence interval not null default '24 hours',
  last_proactive_at timestamptz,
  created_at        timestamptz not null default now()
);
create index companions_user_id_idx on public.companions (user_id);

-- ---------------------------------------------------------------------------
-- messages: the conversation thread per companion
-- ---------------------------------------------------------------------------
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null default '',
  image_url    text,
  audio_url    text,
  -- distinguishes proactive check-ins from replies (for UI + analytics)
  proactive    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index messages_companion_created_idx
  on public.messages (companion_id, created_at);

-- ---------------------------------------------------------------------------
-- memories: embedded facts the companion remembers about the user
-- ---------------------------------------------------------------------------
create table public.memories (
  id           uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  content      text not null,
  embedding    vector(1536) not null,
  importance   int not null default 1,
  created_at   timestamptz not null default now()
);
create index memories_embedding_idx
  on public.memories using hnsw (embedding vector_cosine_ops);
create index memories_companion_idx on public.memories (companion_id);

-- ---------------------------------------------------------------------------
-- RLS: each user only sees their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.companions enable row level security;
alter table public.messages   enable row level security;
alter table public.memories   enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own companions" on public.companions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own memories" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- match_memories: cosine-similarity retrieval, RLS-safe via auth.uid() filter.
-- SECURITY DEFINER so the index is usable; the user_id filter enforces scope.
-- ---------------------------------------------------------------------------
create or replace function public.match_memories (
  p_companion_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 6
)
returns table (id uuid, content text, importance int, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.content,
    m.importance,
    1 - (m.embedding <=> p_query_embedding) as similarity
  from public.memories m
  where m.companion_id = p_companion_id
    and m.user_id = auth.uid()          -- enforce ownership inside definer
  order by m.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

-- ---------------------------------------------------------------------------
-- Create a profile row automatically when a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
