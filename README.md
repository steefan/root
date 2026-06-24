# root — a personal companion AI

A companion AI you chat with by text, voice, or image. It has a personality you
configure, remembers things about you across conversations, and can reach out
with proactive check-ins. Built to be **cheap but not dumb**.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind + shadcn/ui
- **Supabase** — Postgres + `pgvector`, Auth, Storage (all on the free tier to start)
- **Vercel AI SDK v6** via **Vercel AI Gateway** (`provider/model` strings)
- **Chat:** `anthropic/claude-haiku-4-5` (cheap-but-smart; one-line swap to Sonnet)
- **Embeddings:** `openai/text-embedding-3-small` for long-term memory
- **Voice:** OpenAI Whisper (STT) + `gpt-4o-mini-tts` (opt-in TTS)

### Cost design

- Haiku 4.5 as the default chat model (~3× cheaper than Sonnet)
- The persona/system prompt is **prompt-cached** (cached prefix bills at ~0.1×)
- Memory injects only the **top ~6** relevant facts per turn; history is trimmed
- Voice is **opt-in** (record to talk, tap to hear) — no always-on audio
- Runs entirely on Vercel Hobby + Supabase Free in development

## Setup

1. **Install:** `pnpm install`
2. **Supabase:** create a project, then run the SQL in `supabase/migrations/`
   (in order) via the SQL editor or `supabase db push`. This creates the schema,
   RLS policies, the `match_memories` / `due_proactive_companions` functions, and
   the private `media` storage bucket.
   - For quick local testing, disable email confirmation in
     Supabase → Authentication → Providers → Email.
3. **Env:** copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `AI_GATEWAY_API_KEY` (Vercel AI Gateway — auto-injected on Vercel)
   - `OPENAI_API_KEY` (voice)
   - `CRON_SECRET` (any long random string; protects the proactive cron)
4. **Run:** `pnpm dev` → http://localhost:3000

## How it works

- `app/(auth)` — email/password auth via `@supabase/ssr`; `proxy.ts` guards routes.
- `app/(app)/onboarding` — create a companion (name, tone, traits, backstory, voice).
- `app/(app)/chat/[companionId]` — the chat surface (`components/chat.tsx`).
- `app/api/chat` — `streamText` with the cached persona, memory tools, and history trimming.
- `lib/ai/memory.ts` — embeddings + `match_memories` RPC for top-K retrieval.
- `app/api/{transcribe,speak,upload}` — voice in/out and image upload.
- `app/api/cron/proactive` — daily Vercel Cron that messages companions that are due.

## Deploy

Deploy to Vercel, add the env vars (`vercel env`), and connect a Supabase
integration or paste the keys. The cron in `vercel.json` runs daily (Hobby-tier
compatible); bump it to hourly on Pro for finer-grained check-ins.
