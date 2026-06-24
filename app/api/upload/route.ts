import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, signMediaUrl } from "@/lib/media";

export const maxDuration = 30;

// Uploads a chat image to the private media bucket and returns the storage
// path (persisted with the message) + a short-lived signed URL (sent to the
// model for this turn).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const file = form.get("image") as File | null;
  if (!file || file.size === 0) return new Response("No image", { status: 400 });

  const ext = file.name.split(".").pop() || "png";
  const id = crypto.randomUUID();
  const path = `${user.id}/images/${id}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) return new Response(error.message, { status: 500 });

  const url = await signMediaUrl(supabase, path);
  return Response.json({ path, url, mediaType: file.type });
}
