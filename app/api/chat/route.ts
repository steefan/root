import {
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CHAT_MODEL } from "@/lib/ai/gateway";
import { retrieveMemories, saveMemory } from "@/lib/ai/memory";
import { buildPersonaBlock, buildContextBlock } from "@/lib/ai/persona";
import type { Companion } from "@/lib/types";

export const maxDuration = 60;

// Keep only the most recent turns in-context to hold input tokens flat as the
// relationship grows. Long-term continuity comes from retrieved memories, not
// from resending the entire history.
const HISTORY_LIMIT = 20;

// Pull the plain text out of the latest user UI message (parts-based in v6).
function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  const {
    messages,
    companionId,
    imagePath,
  }: { messages: UIMessage[]; companionId: string; imagePath?: string } =
    await req.json();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // RLS guarantees this only returns the caller's companion.
  const { data: companion } = await supabase
    .from("companions")
    .select("*")
    .eq("id", companionId)
    .single<Companion>();
  if (!companion) return new Response("Companion not found", { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single<{ display_name: string | null }>();
  const userName = profile?.display_name ?? undefined;

  // Persist the incoming user turn, then retrieve relevant memories for it.
  const userText = lastUserText(messages);
  if (userText || imagePath) {
    await supabase.from("messages").insert({
      companion_id: companionId,
      user_id: user.id,
      role: "user",
      content: userText,
      image_url: imagePath ?? null,
    });
  }
  const memories = await retrieveMemories(supabase, companionId, userText);

  // Stable (cached) persona block + volatile context block.
  const personaBlock = buildPersonaBlock(companion, userName);
  const contextBlock = buildContextBlock(memories, new Date());

  const history = (await convertToModelMessages(messages)).slice(-HISTORY_LIMIT);
  const modelMessages: ModelMessage[] = [
    {
      role: "system",
      content: personaBlock,
      // Cache the persona prefix — it is identical every turn (~0.1x cost).
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    { role: "system", content: contextBlock },
    ...history,
  ];

  const result = streamText({
    model: companion.model ?? CHAT_MODEL,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      saveMemory: tool({
        description:
          "Save a concise, durable fact about the user worth remembering across conversations (a preference, a person in their life, an important event, a goal, a strong feeling). Use sparingly for things that matter.",
        inputSchema: z.object({
          content: z
            .string()
            .describe("The fact to remember, phrased in third person."),
          importance: z
            .number()
            .int()
            .min(1)
            .max(5)
            .optional()
            .describe("1 = minor, 5 = very important. Default 1."),
        }),
        execute: async ({ content, importance }) => {
          await saveMemory(supabase, companionId, user.id, content, importance ?? 1);
          return { saved: true };
        },
      }),
      recallMemory: tool({
        description:
          "Search your long-term memory for facts about the user relevant to a query. Use when you need a detail you may have been told before.",
        inputSchema: z.object({
          query: z.string().describe("What to look up in memory."),
        }),
        execute: async ({ query }) => {
          const found = await retrieveMemories(supabase, companionId, query);
          return { memories: found.map((m) => m.content) };
        },
      }),
    },
    onFinish: async ({ text }) => {
      if (text.trim()) {
        await supabase.from("messages").insert({
          companion_id: companionId,
          user_id: user.id,
          role: "assistant",
          content: text,
        });
      }
    },
  });

  return result.toUIMessageStreamResponse({
    // Turn provider/gateway failures (most importantly a reached spend limit)
    // into a friendly, in-character message instead of a silent 500.
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("chat stream error:", msg);
      if (
        /credit card|spend|budget|limit|quota|insufficient|payment|Gateway|402|403|429/i.test(
          msg,
        )
      ) {
        return "I need to take a little break right now 💤 — looks like we've hit the usage limit for the moment. Try again a bit later.";
      }
      return "Hmm, something glitched on my end. Give me a sec and try again?";
    },
  });
}
