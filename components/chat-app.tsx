"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { type ReactNode, useMemo, useRef, useState } from "react";
import {
  ExceptionCommandVisual,
  SupplyChainBackdrop,
  ToolCallAnimation,
} from "@/components/supply-chain-animations";

type Mode = "chat" | "agent";
type Theme = "light" | "dark";

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+?\*\*|\*[^*\n]+?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("**")) {
      parts.push(
        <strong key={key} className="markdown-strong">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      parts.push(
        <em key={key} className="markdown-emphasis">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      parts.push(
        <code key={key} className="markdown-code">
          {token.slice(1, -1)}
        </code>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const heading = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
    if (heading) {
      blocks.push(
        <h3 key={`heading-${index}`} className="markdown-heading">
          {heading[1]}
        </h3>,
      );
      return;
    }

    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      blocks.push(
        <div key={`numbered-${index}`} className="markdown-numbered-row">
          <span className="markdown-number">{numbered[1]}</span>
          <div className="markdown-row-content">
            {renderInlineMarkdown(numbered[2], `numbered-${index}`)}
          </div>
        </div>,
      );
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      blocks.push(
        <div key={`bullet-${index}`} className="markdown-bullet-row">
          <span className="markdown-bullet" />
          <div className="markdown-row-content">
            {renderInlineMarkdown(bullet[1], `bullet-${index}`)}
          </div>
        </div>,
      );
      return;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="markdown-paragraph">
        {renderInlineMarkdown(trimmed, `paragraph-${index}`)}
      </p>,
    );
  });

  return <div className="chat-markdown text-sm">{blocks}</div>;
}

function RoleBadge({ role }: { role: string }) {
  const isUser = role === "user";

  return (
    <div className={`role-badge ${isUser ? "role-badge--user" : "role-badge--assistant"}`}>
      <span className="role-badge__icon" aria-hidden="true">
        {isUser ? "OP" : "DX"}
      </span>
      <span>{isUser ? "Operator" : "DevxAI"}</span>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function MessagePart({
  part,
  messageId,
  index,
}: {
  part: UIMessage["parts"][number];
  messageId: string;
  index: number;
}) {
  if (part.type === "text") {
    return <ChatMarkdown text={part.text} />;
  }

  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={part.url}
        alt={part.filename ?? "Uploaded image"}
        className="uploaded-image mt-2 max-h-48 rounded-lg object-contain"
      />
    );
  }

  if (part.type.startsWith("tool-")) {
    const label = part.type.replace("tool-", "");
    const state = "state" in part ? part.state : "unknown";
    return (
      <div
        key={`${messageId}-tool-${index}`}
        className="tool-card mt-3 overflow-hidden rounded-lg px-3 py-2 text-xs"
      >
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <div className="tool-card__title font-medium">Tool: {label}</div>
            <div className="tool-card__status mt-1">
              {state === "input-available" && "Calling..."}
              {state === "output-available" && "Done"}
              {state === "output-error" && "Error"}
            </div>
          </div>
          <ToolCallAnimation toolName={label} state={String(state)} />
        </div>
      </div>
    );
  }

  return null;
}

export function ChatApp() {
  const [mode, setMode] = useState<Mode>("agent");
  const [theme, setTheme] = useState<Theme>("light");
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { mode },
      }),
    [mode],
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const isBusy = status === "streaming" || status === "submitted";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text && !imageFile) return;

    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }
    > = [];

    if (imageFile) {
      parts.push({
        type: "file",
        mediaType: imageFile.type || "image/png",
        url: await fileToDataUrl(imageFile),
        filename: imageFile.name,
      });
    }

    if (text) {
      parts.push({ type: "text", text });
    }

    sendMessage({ parts });
    setInput("");
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div
      className={`app-shell theme-${theme} relative isolate flex min-h-full flex-col overflow-hidden`}
    >
      <SupplyChainBackdrop active theme={theme} />
      <header className="app-header relative z-10 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-kicker text-xs font-medium uppercase tracking-wider">
              Track 2 Supply Chain
            </p>
            <h1 className="app-title text-xl font-semibold tracking-tight">
              Delivery Exception Agent: DevxAI
            </h1>
            <p className="app-muted mt-1 text-sm">
              Triage carrier issues, recover delivery slots, and draft customer options.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented-control flex rounded-full p-1">
              <button
                type="button"
                onClick={() => setMode("chat")}
                className={`segmented-button rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  mode === "chat" ? "is-active" : ""
                }`}
              >
                Lookup
              </button>
              <button
                type="button"
                onClick={() => setMode("agent")}
                className={`segmented-button rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  mode === "agent" ? "is-active" : ""
                }`}
              >
                Exception Agent
              </button>
            </div>
            <button
              type="button"
              className="theme-toggle rounded-full px-3 py-1.5 text-sm font-medium transition"
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            >
              {theme === "light" ? "Dark" : "Light"} mode
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <div className="mode-panel mb-4 rounded-xl p-4 text-sm shadow-2xl backdrop-blur">
          {mode === "chat" ? (
            <p>
              <span className="app-accent font-medium">Lookup mode</span>{" "}
              answers read-only shipment and exception questions. Use it for
              status checks, open exception lists, and carrier notes.
            </p>
          ) : (
            <p>
              <span className="app-accent font-medium">Exception agent</span>{" "}
              investigates a delivery problem, compares recovery slots,
              reschedules when approved, drafts customer copy, and writes ops
              notes.
            </p>
          )}
        </div>

        <div className="conversation-shell relative flex-1 space-y-4 overflow-y-auto rounded-2xl p-4 shadow-2xl backdrop-blur">
          {messages.length === 0 && (
            <div className="empty-state relative z-10 flex h-full min-h-[390px] flex-col items-center justify-center text-center">
              <ExceptionCommandVisual />
              <p className="empty-title text-lg font-medium">
                Try a delivery exception workflow
              </p>
              <ul className="mt-4 max-w-md space-y-2 text-sm">
                <li>“What delivery exceptions are open today?”</li>
                <li>“Order WF-10482 missed its delivery window - fix it”</li>
                <li>“Customer wants the earliest redelivery for tracking 1Z99910482”</li>
                <li>“Summarize options for a weather delay in Denver”</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "message-bubble message-bubble--user"
                    : "message-bubble message-bubble--assistant"
                }`}
              >
                <RoleBadge role={message.role} />
                {message.parts.map((part, index) => (
                  <MessagePart
                    key={`${message.id}-${index}`}
                    part={part}
                    messageId={message.id}
                    index={index}
                  />
                ))}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="busy-row relative z-10 flex items-center gap-3 text-sm">
              <span className="busy-dot inline-block h-2 w-2 animate-pulse rounded-full" />
              {mode === "agent" ? "Resolving exception..." : "Looking up shipment..."}
              <ToolCallAnimation
                toolName={mode === "agent" ? "rescheduleDelivery" : "getShipment"}
                state="input-available"
              />
            </div>
          )}
        </div>

        {error && (
          <p className="error-banner mt-3 rounded-lg px-3 py-2 text-sm">
            {error.message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {imageFile && (
            <div className="app-muted flex items-center gap-2 text-sm">
              <span>
                Image:{" "}
                <span className="app-accent">{imageFile.name}</span>
              </span>
              <button
                type="button"
                className="app-link hover:underline"
                onClick={() => {
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setImageFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="secondary-button rounded-xl px-3 py-2 text-sm font-medium"
              title="Attach an image"
            >
              Image
            </button>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                mode === "agent"
                  ? "Resolve shipment WF-10482..."
                  : "Look up order WF-10482..."
              }
              className="message-input flex-1 rounded-xl px-4 py-2 text-sm outline-none"
              disabled={isBusy}
            />
            {isBusy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="secondary-button rounded-xl px-4 py-2 text-sm font-medium"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !imageFile}
                className="primary-button rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
