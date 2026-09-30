import { formatDateTime } from "./time";
import { useEffect, useRef, useState } from "react";
import { VoiceBeam, getAudioContext } from "voice-glow";
import { BorderBeam } from "border-beam";
import { EveCall, evePost, recentMessages } from "./eve-client";
import type { EveReply, Message } from "./eve-client";
import type { PersonId, Snapshot } from "./types";
import "./eve.css";

type ChatMessage = Message & {
  id: string;
  revision?: number;
  start?: number;
  end?: number;
};
type VoiceState = "off" | "connecting" | "on" | "closing";
function Mic({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3M9 21h6" />
      {muted && <path d="m3 3 18 18" />}
    </svg>
  );
}

export function Eve({
  snapshot,
  person,
  onBack,
}: {
  snapshot: Snapshot;
  person: PersonId;
  onBack: () => void;
}) {
  const h = snapshot.households.find((h) => h.id === person)!;
  const scope = {
    sessionId: snapshot.session.id,
    person,
    ...(snapshot.historical ? { at: snapshot.cutoff } : {}),
  };
  const memoryKey = `bt-eve/${scope.sessionId}/${person}/${scope.at ?? "live"}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(memoryKey) || "[]");
      return Array.isArray(saved)
        ? saved
            .filter(
              (m) =>
                m &&
                typeof m.id === "string" &&
                ["user", "assistant"].includes(m.role) &&
                typeof m.content === "string",
            )
            .slice(-100)
        : [];
    } catch {
      return [];
    }
  });
  const messagesRef = useRef<ChatMessage[]>(messages);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [voice, setVoice] = useState<VoiceState>("off");
  const [voiceCaption, setVoiceCaption] = useState<{
    role: string;
    text: string;
  } | null>(null);
  const [muted, setMuted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);
  const [evidence, setEvidence] = useState<EveReply | null>(null);
  const [showContext, setShowContext] = useState(false);
  const call = useRef<EveCall | null>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const transcriptGroups = useRef<Partial<Record<Message["role"], string>>>({});
  const reducedMotion = useRef(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const updateMessages = (next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
    try {
      sessionStorage.setItem(memoryKey, JSON.stringify(next.slice(-100)));
    } catch {
      /* Conversation still works when browser storage is unavailable. */
    }
  };
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 88)}px`;
    }
  }, [draft, voice]);

  useEffect(() => {
    const controller = new AbortController();
    const check = async () => {
      try {
        const response = await fetch("/api/eve/status", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        setConfigured(data.configured);
      } catch {
        if (!controller.signal.aborted) setConfigured(null);
      }
    };
    void check();
    const interval = setInterval(check, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
      request.current?.abort();
      call.current?.dispose();
    };
  }, []);
  useEffect(() => {
    thread.current?.scrollTo({
      top: thread.current.scrollHeight,
      behavior: "instant",
    });
  }, [messages, thinking]);
  useEffect(() => {
    void call.current?.refreshContext();
  }, [snapshot.cutoff]);

  const send = async (content = draft, retry = false) => {
    if (busy.current || voice !== "off" || !content.trim() || !configured)
      return;
    busy.current = true;
    setThinking(true);
    setError("");
    setDraft("");
    const next = retry
      ? messagesRef.current
      : [
          ...messagesRef.current,
          {
            id: crypto.randomUUID(),
            role: "user" as const,
            content: content.trim(),
          },
        ];
    updateMessages(next);
    const controller = (request.current = new AbortController());
    try {
      const reply = await evePost<EveReply>(
        "chat",
        { ...scope, messages: recentMessages(next) },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setEvidence(reply);
      updateMessages([
        ...messagesRef.current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply.text,
          revision: reply.revision,
        },
      ]);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) {
        setThinking(false);
        input.current?.focus();
      }
    }
  };

  const startVoice = () => {
    if (voice !== "off" || busy.current || !configured) return;
    getAudioContext(); // Resume audio synchronously with the explicit call gesture.
    setError("");
    setVoice("connecting");
    setVoiceCaption(null);
    setMuted(false);
    transcriptGroups.current = {};
    const connection = new EveCall(scope, {
      onReady: () => setVoice("on"),
      onStream: setStream,
      onOutputStream: setOutputStream,
      onThinking: setThinking,
      onEvidence: setEvidence,
      onError: setError,
      onClosed: () => {
        setVoice("off");
        call.current = null;
      },
      getMessages: () => messagesRef.current,
      onTranscript: (role, delta, start, end) => {
        const previousId = transcriptGroups.current[role];
        const previous = messagesRef.current.find((m) => m.id === previousId);
        // Each speaker has their own timeline: overlapping speech stays separate.
        if (
          previous &&
          typeof previous.end === "number" &&
          start - previous.end < 1600
        ) {
          setVoiceCaption({ role, text: previous.content + delta });
          updateMessages(
            messagesRef.current.map((m) =>
              m.id === previousId
                ? { ...m, content: m.content + delta, end }
                : m,
            ),
          );
        } else {
          setVoiceCaption({ role, text: delta });
          const id = crypto.randomUUID();
          transcriptGroups.current[role] = id;
          updateMessages([
            ...messagesRef.current,
            { id, role, content: delta, start, end },
          ]);
        }
      },
    });
    call.current = connection;
    void connection.start();
  };
  const endVoice = () => {
    setVoice("closing");
    call.current?.end();
  };
  const prompts =
    person === "daniel"
      ? ["What’s happening with my broadband?", "Is Aisha still calling me?"]
      : person === "sam"
        ? ["My hub arrived. What happens next?", "Is my service affected?"]
        : [
            "Do you know why my hub goes quiet?",
            "My broadband isn’t working tonight.",
          ];
  const time = new Date(snapshot.clock).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
  const activeVoice = voice !== "off";

  return (
    <VoiceBeam
      type="mobile"
      className="eve-mobile-beam"
      theme={activeVoice ? "dark" : "light"}
      colors={
        activeVoice
          ? ["#ac80df", "#708dcc", "#64a99b", "#c091a1", "#c8b28b"]
          : ["#5514b4", "#9272be", "#7a9cae", "#bb87a2", "#b9a1d3"]
      }
      style={{ display: "flex", flex: 1, minHeight: 0, width: "100%" }}
      hueRange={0}
      strength={activeVoice ? 0.9 : 0.5}
      scale={0.9}
      bend={62}
      bandOffset={18}
      bandStrength={2.4}
      borderRadius={0}
      idle={voice === "on" ? 0.4 : 0}
      paused={reducedMotion.current}
      // The phone-wide glow belongs to voice. Text uses the chat-input glow on the composer.
      active={activeVoice}
      processing={activeVoice && (thinking || voice === "connecting")}
      stream={
        voiceCaption?.role === "assistant" && outputStream
          ? outputStream
          : muted
            ? null
            : stream
      }
    >
      <section
        className={`eve ${activeVoice ? "eve-voice-active" : ""}`}
        aria-label="Eve support conversation"
      >
        <header className="eve-header">
          <button
            className="eve-back"
            onClick={onBack}
            aria-label="Back to My BT"
          >
            ‹
          </button>
          <span className="eve-mark" aria-hidden="true">
            e<span>•</span>
          </span>
          <div>
            <strong>Eve</strong>
            <small>Your AI support assistant</small>
          </div>
          <span
            className={`eve-connection ${voice === "on" ? "connected" : ""}`}
            title={
              voice === "on"
                ? "Voice connected"
                : configured
                  ? "API configured"
                  : "Not connected"
            }
          />
        </header>
        <button
          className="eve-context-toggle"
          onClick={() => setShowContext(!showContext)}
          aria-expanded={showContext}
        >
          <span>
            <i /> {h.name.split(" ")[0]}’s broadband <b>·</b> {time}
          </span>
          <span>{showContext ? "−" : "+"} Context</span>
        </button>
        {showContext && (
          <div className="eve-context">
            <strong>Same account. Same context.</strong>
            <dl>
              <div>
                <dt>Service</dt>
                <dd>{h.serviceState}</dd>
              </div>
              <div>
                <dt>Case owner</dt>
                <dd>{h.owner || "None assigned"}</dd>
              </div>
              <div>
                <dt>Callback</dt>
                <dd>
                  {h.promise
                    ? h.promiseFulfilled
                      ? "Completed"
                      : `Due ${formatDateTime(h.promise)}`
                    : "None recorded"}
                </dd>
              </div>
              <div>
                <dt>Incident</dt>
                <dd>
                  {snapshot.operations.incident
                    ? h.incidentCleared
                      ? "Cleared · historically in scope"
                      : h.incident
                      ? "In scope"
                      : "Outside scope"
                    : "Not confirmed"}
                </dd>
              </div>
            </dl>
            <small>
              Customer memory + operational state · rev {snapshot.cutoff}
              {snapshot.historical ? " · historical" : ""}
            </small>
            <button
              className="eve-clear"
              disabled={activeVoice || thinking || !messages.length}
              onClick={() => {
                updateMessages([]);
                setEvidence(null);
                setError("");
              }}
            >
              Clear conversation
            </button>
          </div>
        )}
        <div
          className={`eve-thread ${activeVoice ? "eve-voice-transcript" : ""}`}
          ref={thread}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {activeVoice && (
            <div className="eve-voice-copy">
              {voiceCaption && (
                <small>{voiceCaption.role === "user" ? "You" : "Eve"}</small>
              )}
              <p>
                {voice === "connecting"
                  ? "A moment.\nConnecting you to Eve."
                  : voice === "closing"
                    ? "Back to your conversation."
                    : voiceCaption
                      ? voiceCaption.text.length > 240
                        ? "…" +
                          voiceCaption.text.slice(-230).replace(/^\S*\s/, "")
                        : voiceCaption.text
                      : "What’s on your mind?"}
              </p>
            </div>
          )}
          {!activeVoice && !messages.length && (
            <div className="eve-welcome">
              <span className="eve-welcome-label">
                A little less explaining.
              </span>
              <h3>
                Let’s pick up
                <br />
                from here.
              </h3>
              <p>
                Hi {h.name.split(" ")[0]}, I’m Eve. I can read your service
                history and recent updates, so you don’t have to start again.
              </p>
              <div className="eve-context-pills">
                <span>Customer memory</span>
                <span>Service context</span>
              </div>
              <div className="eve-prompts">
                {prompts.map((p) => (
                  <button
                    key={p}
                    disabled={!configured}
                    onClick={() => void send(p)}
                  >
                    {p}
                    <span>↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!activeVoice &&
            messages.map((m) => (
              <article key={m.id} className={`eve-message ${m.role}`}>
                <small>
                  {m.role === "user" ? "You" : "Eve"}
                  {m.revision !== undefined && (
                    <span> · context {m.revision}</span>
                  )}
                </small>
                <p>{m.content}</p>
              </article>
            ))}
          {!activeVoice && thinking && (
            <div className="eve-thinking" role="status">
              <span>•••</span> Reading your context
            </div>
          )}
        </div>
        {!activeVoice && evidence && (
          <details className="eve-evidence">
            <summary>
              Records read{" "}
              <span>
                {evidence.records.length} · rev {evidence.revision}
              </span>
            </summary>
            <div>
              {evidence.records.map((r) => (
                <p key={r.id}>{r.description}</p>
              ))}
              <small>{evidence.model} · read-only</small>
            </div>
          </details>
        )}
        {error && (
          <div className="eve-error" role="alert">
            <p>{error}</p>
            {voice === "off" && messages.at(-1)?.role === "user" && (
              <button
                disabled={thinking}
                onClick={() => void send(messages.at(-1)!.content, true)}
              >
                Try again ↗
              </button>
            )}
          </div>
        )}
        {configured === false && (
          <div className="eve-setup">
            Add your OpenAI key to <code>app/.env.local</code> to connect Eve.
            This screen checks automatically.
          </div>
        )}
        <div className="eve-input-area">
          {activeVoice ? (
            <div className="eve-composer">
              <div className="eve-call-controls">
                <button
                  aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                  aria-pressed={muted}
                  disabled={voice !== "on"}
                  onClick={() => {
                    call.current?.mute(!muted);
                    setMuted(!muted);
                  }}
                >
                  <Mic muted={muted} />
                </button>
                <span>
                  {voice === "connecting"
                    ? "Connecting…"
                    : voice === "closing"
                      ? "Ending call…"
                      : muted
                        ? "Microphone muted"
                        : thinking
                          ? "Reading your context…"
                          : "Voice is on"}
                  <small>AI voice</small>
                </span>
                <button
                  className="eve-end"
                  onClick={endVoice}
                  disabled={voice === "closing"}
                  aria-label="End voice call"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>
            ) : (
              // Text chat: a border beam travels round the composer while Eve writes her reply.
              <BorderBeam
                className="eve-input-beam"
                size="md"
                theme="light"
                colorVariant="ocean"
                strength={0.9}
                duration={2.2}
                active={thinking && !reducedMotion.current}
              >
              <div className="eve-composer">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <textarea
                  ref={input}
                  aria-label="Message Eve"
                  placeholder="Ask Eve anything…"
                  rows={1}
                  maxLength={4000}
                  value={draft}
                  disabled={thinking}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="eve-compose-actions">
                  <span className="eve-composer-hint">Message or talk</span>
                  <div>
                    <button
                      type="button"
                      className="eve-voice-launch"
                      onClick={startVoice}
                      disabled={thinking || !configured}
                      aria-label="Start voice call with Eve"
                    >
                      <Mic />
                      <span>Voice</span>
                    </button>
                    <button
                      className="eve-send"
                      type="submit"
                      aria-label="Send to Eve"
                      disabled={!draft.trim() || thinking || !configured}
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </form>
              </div>
              </BorderBeam>
            )}
          <div className="eve-input-meta">
            <span>
              {activeVoice
                ? "You can interrupt naturally"
                : "AI support · powered by OpenAI"}
            </span>
          </div>
        </div>
      </section>
    </VoiceBeam>
  );
}
