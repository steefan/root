"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/media";
import type { Personality } from "@/lib/types";

function parsePersonality(formData: FormData): Personality {
  const traits = String(formData.get("traits") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    tone: String(formData.get("tone") || "").trim() || undefined,
    traits: traits.length ? traits : undefined,
    backstory: String(formData.get("backstory") || "").trim() || undefined,
    notes: String(formData.get("notes") || "").trim() || undefined,
  };
}

export async function createCompanion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/onboarding?error=Please give your companion a name.");

  const { data, error } = await supabase
    .from("companions")
    .insert({
      user_id: user.id,
      name,
      personality: parsePersonality(formData),
      voice: String(formData.get("voice") || "alloy"),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(`/onboarding?error=${encodeURIComponent(error?.message ?? "Failed")}`);
  }
  redirect(`/chat/${data.id}`);
}

export async function updateCompanion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id"));
  const cadenceHours = Number(formData.get("proactive_cadence_hours") || 24);

  const { error } = await supabase
    .from("companions")
    .update({
      name: String(formData.get("name") || "").trim(),
      personality: parsePersonality(formData),
      voice: String(formData.get("voice") || "alloy"),
      proactive_enabled: formData.get("proactive_enabled") === "on",
      proactive_cadence: `${Math.max(1, cadenceHours)} hours`,
    })
    .eq("id", id);

  if (error) {
    redirect(`/settings/${id}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/settings/${id}`);
  redirect(`/settings/${id}?message=Saved`);
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id"));
  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) redirect(`/settings/${id}`);

  const ext = file.name.split(".").pop() || "png";
  const path = `${user.id}/avatars/${id}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    redirect(`/settings/${id}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("companions").update({ avatar_url: path }).eq("id", id);
  revalidatePath(`/settings/${id}`);
  redirect(`/settings/${id}?message=Avatar updated`);
}

export async function deleteCompanion(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("companions").delete().eq("id", id);
  redirect("/chat");
}
