import { experimental_generateSpeech as generateSpeech } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { SPEECH_MODEL, VOICES } from "@/lib/ai/gateway";

export const maxDuration = 60;

// Text-to-speech. Opt-in only (user taps to hear a reply). Returns audio bytes
// directly — no storage round-trip, keeping it simple and cheap.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { text, voice } = (await req.json()) as {
    text?: string;
    voice?: string;
  };
  if (!text?.trim()) return new Response("No text", { status: 400 });

  const chosen = VOICES.includes(voice as (typeof VOICES)[number])
    ? voice!
    : "alloy";

  try {
    const { audio } = await generateSpeech({
      model: openai.speech(SPEECH_MODEL),
      text: text.slice(0, 4000),
      voice: chosen,
    });
    return new Response(new Uint8Array(audio.uint8Array), {
      headers: {
        "Content-Type": audio.mediaType ?? "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("speak failed:", err);
    return new Response("Speech failed", { status: 500 });
  }
}
