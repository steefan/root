"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Kicks off Google OAuth. Supabase redirects to Google, then back to
// /auth/callback which exchanges the code for a session.
export function GoogleButton({ next = "/chat" }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      toast.error("Couldn't start Google sign-in.");
      setLoading(false);
    }
    // On success the browser redirects to Google — no further UI needed.
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={signIn}
      disabled={loading}
    >
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
