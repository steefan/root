import { createCompanion } from "../companion-actions";
import { VOICES } from "@/lib/ai/gateway";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create your companion</CardTitle>
          <CardDescription>
            Give them a name and a personality. You can change all of this later.
          </CardDescription>
        </CardHeader>
        <form action={createCompanion}>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="e.g. Mika" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Input
                id="tone"
                name="tone"
                placeholder="e.g. warm, playful, a little sarcastic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="traits">Traits (comma-separated)</Label>
              <Input
                id="traits"
                name="traits"
                placeholder="e.g. curious, supportive, witty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backstory">Backstory (optional)</Label>
              <Textarea
                id="backstory"
                name="backstory"
                placeholder="Who are they? How do they know you?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <select
                id="voice"
                name="voice"
                defaultValue="alloy"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
          <CardFooter className="mt-4">
            <Button type="submit" className="w-full">
              Create companion
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
