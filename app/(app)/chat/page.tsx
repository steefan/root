import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Entry point: send the user to their most recent companion, or to onboarding
// if they don't have one yet.
export default async function ChatIndex() {
  const supabase = await createClient();
  const { data: companions } = await supabase
    .from("companions")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!companions || companions.length === 0) {
    redirect("/onboarding");
  }
  redirect(`/chat/${companions[0].id}`);
}
