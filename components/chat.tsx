"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
  companionId: string;
  companionName: string;
  voice: string;
  avatarUrl: string | null;
  initialMessages: UIMessage[];
};

type PendingImage = { path: string; url: string; mediaType: string };

export function Chat({
  companionId,
  companionName,
  voice,
  avatarUrl,
  initialMessages,
}: Props) {
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { companionId },
    }),
    messages: initialMessages,
  });

  const busy = status === "submitted" || status === "streaming";

  function scrollDown() {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !pendingImage) || busy) return;

    if (pendingImage) {
      sendMessage(
        {
          text,
          files: [
            {
              type: "file",
              url: pendingImage.url,
              mediaType: pendingImage.mediaType,
            },
          ],
        },
        { body: { imagePath: pendingImage.path } },
      );
    } else {
      sendMessage({ text });
    }
    setInput("");
    setPendingImage(null);
    scrollDown();
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as PendingImage;
      setPendingImage(data);
    } catch {
      toast.error("Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await transcribe(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Couldn't access the microphone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const { text } = (await res.json()) as { text: string };
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    } catch {
      toast.error("Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  const inputDisabled = busy || transcribing;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <p className="mt-12 text-center text-sm text-muted-foreground">
              Say hi to {companionName}.
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              companionName={companionName}
              avatarUrl={avatarUrl}
              voice={voice}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {pendingImage && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage.url}
                alt="attachment"
                className="h-12 w-12 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="hover:text-foreground"
              >
                remove
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickImage}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={inputDisabled || uploading}
              aria-label="Attach image"
              title="Attach image"
            >
              {uploading ? "…" : "📎"}
            </Button>
            <Button
              type="button"
              variant={recording ? "destructive" : "outline"}
              size="icon"
              onClick={recording ? stopRecording : startRecording}
              disabled={inputDisabled}
              aria-label={recording ? "Stop recording" : "Record voice"}
              title={recording ? "Stop recording" : "Record voice"}
            >
              {recording ? "■" : transcribing ? "…" : "🎤"}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                transcribing ? "Transcribing…" : `Message ${companionName}…`
              }
              disabled={inputDisabled}
              autoFocus
            />
            <Button
              type="submit"
              disabled={busy || (!input.trim() && !pendingImage)}
            >
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  companionName,
  avatarUrl,
  voice,
}: {
  message: UIMessage;
  companionName: string;
  avatarUrl: string | null;
  voice: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const isUser = message.role === "user";

  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
  const images = message.parts.filter(
    (p): p is { type: "file"; url: string; mediaType: string } =>
      p.type === "file" && p.mediaType?.startsWith("image/"),
  );

  async function speak() {
    if (speaking || !text) return;
    setSpeaking(true);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setSpeaking(false);
      await audio.play();
    } catch {
      toast.error("Couldn't play audio.");
      setSpeaking(false);
    }
  }

  return (
    <div
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={companionName} />}
          <AvatarFallback>{companionName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={img.url}
            alt="shared"
            className="max-w-[80%] rounded-2xl"
          />
        ))}
        {(text || (!isUser && images.length === 0)) && (
          <div
            className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {text || "…"}
          </div>
        )}
        {!isUser && text && (
          <button
            type="button"
            onClick={speak}
            disabled={speaking}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Play voice"
          >
            {speaking ? "playing…" : "▶ play"}
          </button>
        )}
      </div>
    </div>
  );
}
