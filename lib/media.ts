import type { SupabaseClient } from "@supabase/supabase-js";

export const MEDIA_BUCKET = "media";
const SIGNED_TTL = 60 * 60; // 1 hour

// Turn a stored object path (e.g. "<uid>/avatars/x.png") into a temporary
// signed URL the browser (and the model) can read. Returns null if no path or
// signing fails.
export async function signMediaUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (error) {
    console.error("createSignedUrl failed:", error.message);
    return null;
  }
  return data.signedUrl;
}
