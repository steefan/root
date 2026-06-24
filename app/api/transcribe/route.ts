import { experimental_transcribe as transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { TRANSCRIBE_MODEL } from "@/lib/ai/gateway";

export const maxDuration = 60;

// Speech-to-text. Only runs when the user records audio (cheap, ~$0.006/min).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const file = form.get("audio") as File | null;
  if (!file) return new Response("No audio", { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const { text } = await transcribe({
      model: openai.transcription(TRANSCRIBE_MODEL),
      audio: bytes,
    });
    return Response.json({ text });
  } catch (err) {
    console.error("transcribe failed:", err);
    return new Response("Transcription failed", { status: 500 });
  }
}
