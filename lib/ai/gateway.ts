// Central place for model selection. All strings are Vercel AI Gateway
// "provider/model" identifiers — no provider-specific SDK packages needed.
//
// Cost note (per 1M tokens): Haiku 4.5 = $1 in / $5 out, Sonnet 4.6 = $3 / $15.
// Haiku is the cheap-but-smart default. Bumping a companion to Sonnet is a
// one-line change here (or per-companion via the `model` column later).

export const CHAT_MODEL = "anthropic/claude-haiku-4-5";

// Smarter fallback if a companion ever needs deeper conversation.
export const CHAT_MODEL_SMART = "anthropic/claude-sonnet-4-6";

// Embeddings for long-term memory. Cheap ($0.02/1M) — 1536 dims.
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

// Voice models (OpenAI via the AI SDK transcription/speech helpers).
export const TRANSCRIBE_MODEL = "whisper-1";
export const SPEECH_MODEL = "gpt-4o-mini-tts";

// TTS voices offered in the UI (gpt-4o-mini-tts).
export const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
] as const;
