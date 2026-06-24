import Link from "next/link";
import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/(auth)/actions";
import { Chat } from "@/components/chat";
import { Button, buttonVariants } from "@/components/ui/button";
import { signMediaUrl } from "@/lib/media";
import type { Companion, Message } from "@/lib/types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ companionId: string }>;
}) {
  const { companionId } = await params;
  const supabase = await createClient();

  const { data: companion } = await supabase
    .from("companions")
    .select("*")
    .eq("id", companionId)
    .single<Companion>();
  if (!companion) notFound();

  const { data: rows } = await supabase
    .from("messages")
    .select("*")
    .eq("companion_id", companionId)
    .order("created_at", { ascending: true })
    .returns<Message[]>();

  const initialMessages: UIMessage[] = await Promise.all(
    (rows ?? []).map(async (m) => {
      const parts: UIMessage["parts"] = [];
      if (m.image_url) {
        const url = await signMediaUrl(supabase, m.image_url);
        if (url) {
          parts.push({ type: "file", url, mediaType: "image/*" });
        }
      }
      parts.push({ type: "text", text: m.content });
      return { id: m.id, role: m.role, parts };
    }),
  );

  const avatarUrl = await signMediaUrl(supabase, companion.avatar_url);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold">{companion.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/settings/${companion.id}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Settings
          </Link>
          <form action={signout}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Chat
          companionId={companion.id}
          companionName={companion.name}
          voice={companion.voice}
          avatarUrl={avatarUrl}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}
