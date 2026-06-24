// Row shapes mirroring supabase/migrations. Hand-maintained (no codegen) to
// keep the toolchain light.

export type Personality = {
  tone?: string;
  traits?: string[];
  backstory?: string;
  // Free-form extra guidance appended to the system prompt.
  notes?: string;
};

export type Companion = {
  id: string;
  user_id: string;
  name: string;
  personality: Personality;
  avatar_url: string | null;
  voice: string;
  model: string | null;
  proactive_enabled: boolean;
  proactive_cadence: string; // postgres interval, e.g. "24:00:00"
  last_proactive_at: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  companion_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  audio_url: string | null;
  proactive: boolean;
  created_at: string;
};

export type Memory = {
  id: string;
  companion_id: string;
  user_id: string;
  content: string;
  importance: number;
  created_at: string;
};
