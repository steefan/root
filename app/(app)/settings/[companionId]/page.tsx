import Link from "next/link";
import { notFound } from "next/navigation";
import {
  updateCompanion,
  uploadAvatar,
  deleteCompanion,
} from "../../companion-actions";
import { createClient } from "@/lib/supabase/server";
import { signMediaUrl } from "@/lib/media";
import { VOICES } from "@/lib/ai/gateway";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Companion } from "@/lib/types";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companionId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { companionId } = await params;
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const { data: companion } = await supabase
    .from("companions")
    .select("*")
    .eq("id", companionId)
    .single<Companion>();
  if (!companion) notFound();

  const p = companion.personality ?? {};
  const avatarUrl = await signMediaUrl(supabase, companion.avatar_url);
  const cadenceHours = Math.round(
    parseCadenceToHours(companion.proactive_cadence),
  );

  return (
    <div className="mx-auto w-full max-w-lg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{companion.name} · settings</h1>
        <Link
          href={`/chat/${companion.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Back to chat
        </Link>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {message && (
        <p className="mb-3 text-sm text-muted-foreground">{message}</p>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadAvatar} className="flex items-center gap-4">
            <input type="hidden" name="id" value={companion.id} />
            <Avatar className="h-14 w-14">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={companion.name} />
              )}
              <AvatarFallback>
                {companion.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Input
              type="file"
              name="avatar"
              accept="image/*"
              className="max-w-xs"
            />
            <Button type="submit" variant="outline" size="sm">
              Upload
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personality</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateCompanion} className="space-y-4">
            <input type="hidden" name="id" value={companion.id} />
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={companion.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Input id="tone" name="tone" defaultValue={p.tone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="traits">Traits (comma-separated)</Label>
              <Input
                id="traits"
                name="traits"
                defaultValue={(p.traits ?? []).join(", ")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backstory">Backstory</Label>
              <Textarea
                id="backstory"
                name="backstory"
                defaultValue={p.backstory ?? ""}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Extra guidance</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={p.notes ?? ""}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <select
                id="voice"
                name="voice"
                defaultValue={companion.voice}
                className={selectCls}
              >
                {VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="proactive_enabled"
                name="proactive_enabled"
                type="checkbox"
                defaultChecked={companion.proactive_enabled}
                className="h-4 w-4"
              />
              <Label htmlFor="proactive_enabled" className="font-normal">
                Send me proactive check-ins
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proactive_cadence_hours">
                Check in at most every (hours)
              </Label>
              <Input
                id="proactive_cadence_hours"
                name="proactive_cadence_hours"
                type="number"
                min={1}
                defaultValue={cadenceHours}
                className="max-w-[8rem]"
              />
            </div>

            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <form action={deleteCompanion} className="mt-6">
        <input type="hidden" name="id" value={companion.id} />
        <Button type="submit" variant="destructive" size="sm">
          Delete companion
        </Button>
      </form>
    </div>
  );
}

// Postgres returns intervals like "24:00:00" or "1 day". Coarse parse → hours.
function parseCadenceToHours(interval: string): number {
  if (!interval) return 24;
  const dayMatch = interval.match(/(\d+)\s*day/);
  if (dayMatch) return Number(dayMatch[1]) * 24;
  const hms = interval.match(/^(\d+):(\d+):/);
  if (hms) return Number(hms[1]);
  const hourMatch = interval.match(/(\d+)\s*hour/);
  if (hourMatch) return Number(hourMatch[1]);
  return 24;
}
