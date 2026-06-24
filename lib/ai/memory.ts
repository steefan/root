import { embed } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_MODEL } from "./gateway";

export type RetrievedMemory = {
  id: string;
  content: string;
  importance: number;
  similarity: number;
};

// Embed a single string via the AI Gateway (text-embedding-3-small, 1536 dims).
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: text });
  return embedding;
}

// Top-K semantic retrieval via the match_memories RPC. Keeping K small (~6) is
// the main lever for cheap-but-smart context: only the most relevant facts go
// into the prompt, not the whole memory store.
export async function retrieveMemories(
  supabase: SupabaseClient,
  companionId: string,
  query: string,
  count = 6,
): Promise<RetrievedMemory[]> {
  if (!query.trim()) return [];
  const embedding = await embedText(query);
  const { data, error } = await supabase.rpc("match_memories", {
    p_companion_id: companionId,
    p_query_embedding: embedding,
    p_match_count: count,
  });
  if (error) {
    console.error("match_memories failed:", error.message);
    return [];
  }
  return (data ?? []) as RetrievedMemory[];
}

// Persist a new memory with its embedding.
export async function saveMemory(
  supabase: SupabaseClient,
  companionId: string,
  userId: string,
  content: string,
  importance = 1,
): Promise<void> {
  const embedding = await embedText(content);
  const { error } = await supabase.from("memories").insert({
    companion_id: companionId,
    user_id: userId,
    content,
    embedding,
    importance,
  });
  if (error) console.error("saveMemory failed:", error.message);
}
