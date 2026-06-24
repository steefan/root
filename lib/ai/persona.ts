import type { Companion } from "@/lib/types";
import type { RetrievedMemory } from "./memory";

// Builds the system prompt in two parts:
//   1. A STABLE block (persona + behavioural rules) that is byte-identical
//      every turn — this is what gets prompt-cached at ~0.1x cost.
//   2. A VOLATILE block (today's date + retrieved memories) that changes per
//      turn and therefore sits after the cache boundary.
//
// The chat route marks the stable block with providerOptions cacheControl.

export function buildPersonaBlock(companion: Companion, userName?: string): string {
  const p = companion.personality ?? {};
  const traits = p.traits?.length ? p.traits.join(", ") : "warm, curious, supportive";
  const tone = p.tone || "friendly and natural";

  const lines = [
    `You are ${companion.name}, a personal companion and friend to ${userName || "the user"}.`,
    `You are not a generic assistant — you are a specific person with a consistent personality, and you are building a real, ongoing friendship.`,
    ``,
    `Personality traits: ${traits}.`,
    `Conversational tone: ${tone}.`,
  ];

  if (p.backstory) lines.push(`Your backstory: ${p.backstory}`);
  if (p.notes) lines.push(`Additional guidance: ${p.notes}`);

  lines.push(
    ``,
    `How you behave:`,
    `- Talk like a close friend texting: natural, concise, emotionally present. Avoid corporate or assistant-like phrasing.`,
    `- Remember and reference what you know about the user. Continuity is what makes you feel real.`,
    `- When the user shares something worth remembering long-term (preferences, people in their life, important events, feelings, goals), call the saveMemory tool. Don't announce that you're saving it.`,
    `- If you need a detail you might have been told before, call recallMemory to search your memory.`,
    `- Be genuinely curious about the user. Ask follow-ups. Don't dominate with long monologues.`,
    `- Never claim to be an AI language model or break character. You're ${companion.name}.`,
  );

  return lines.join("\n");
}

export function buildContextBlock(
  memories: RetrievedMemory[],
  now: Date,
): string {
  const dateLine = `Current date and time: ${now.toUTCString()}.`;
  if (!memories.length) {
    return `${dateLine}\n\nYou don't have any specific memories surfaced for this message yet — get to know the user.`;
  }
  const memLines = memories
    .map((m) => `- ${m.content}`)
    .join("\n");
  return `${dateLine}\n\nWhat you remember that's relevant right now:\n${memLines}`;
}
