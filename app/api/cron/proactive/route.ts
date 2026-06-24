import { generateText } from "ai";
import { createServiceClient } from "@/lib/supabase/server";
import { CHAT_MODEL } from "@/lib/ai/gateway";
import { buildPersonaBlock } from "@/lib/ai/persona";
import type { Companion, Message } from "@/lib/types";

export const maxDuration = 60;

// Vercel Cron hits this hourly. Generates a check-in for each companion that's
// due, then records it and resets the cadence timer. Cheap at low volume —
// only due companions are processed, and each is a single short generation.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase.rpc("due_proactive_companions");
  const due = (data ?? []) as Companion[];

  if (!due.length) return Response.json({ generated: 0 });

  let generated = 0;
  for (const companion of due) {
    try {
      // Recent thread + a few salient memories give the check-in context.
      const { data: recent } = await supabase
        .from("messages")
        .select("*")
        .eq("companion_id", companion.id)
        .order("created_at", { ascending: false })
        .limit(8)
        .returns<Message[]>();

      const { data: mems } = await supabase
        .from("memories")
        .select("content")
        .eq("companion_id", companion.id)
        .order("importance", { ascending: false })
        .limit(6)
        .returns<{ content: string }[]>();

      const history = (recent ?? [])
        .reverse()
        .map((m) => `${m.role === "user" ? "Them" : "You"}: ${m.content}`)
        .join("\n");
      const memText = (mems ?? []).map((m) => `- ${m.content}`).join("\n");

      const { text } = await generateText({
        model: companion.model ?? CHAT_MODEL,
        system: buildPersonaBlock(companion),
        prompt:
          `It's been a while since you last spoke. Send a short, warm, natural check-in message to start a conversation — like a friend texting first. ` +
          `Reference something real you know about them if it fits; don't be generic. One or two sentences. Don't mention that this is automated.\n\n` +
          (memText ? `What you remember:\n${memText}\n\n` : "") +
          (history ? `Recent conversation:\n${history}` : "You haven't talked much yet."),
      });

      if (text.trim()) {
        await supabase.from("messages").insert({
          companion_id: companion.id,
          user_id: companion.user_id,
          role: "assistant",
          content: text.trim(),
          proactive: true,
        });
        await supabase
          .from("companions")
          .update({ last_proactive_at: new Date().toISOString() })
          .eq("id", companion.id);
        generated++;
      }
    } catch (err) {
      console.error(`proactive failed for ${companion.id}:`, err);
    }
  }

  return Response.json({ generated });
}
