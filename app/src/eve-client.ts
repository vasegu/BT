import { invalidateSnapshot } from "./snapshot-client.ts";
import type { Snapshot, PersonId } from "./types";

export type Message = { role: "user" | "assistant"; content: string };
export type EveScope = { sessionId: string; person: PersonId; at?: number };
export function eveScope(snapshot: Snapshot, person: PersonId): EveScope {
  return { sessionId: snapshot.session.id, person, at: snapshot.cutoff };
}
// Never deliver a partial claim with its final qualification cut off.
export function spokenAnswer(text: string): string {
  return text.length <= 1000 ? text : "The full answer is in our conversation. It needs more detail than I can safely shorten here. Please read it there, or ask me one specific part. I haven’t changed your account.";
}
export type EveReply = {
  text: string;
  revision: number;
  model: string;
  records: { id: string; description: string; time: string }[];
};

export async function evePost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/eve/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-BT-Demo": "1" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([
      AbortSignal.timeout(55000),
      ...(signal ? [signal] : []),
    ]),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Eve could not connect. Please try again.");
  if (path === "chat" && body && typeof body === "object" && "sessionId" in body && typeof body.sessionId === "string") {
    invalidateSnapshot(body.sessionId);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent("bt-eve-updated", { detail: { sessionId: body.sessionId } }));
  }
  return data;
}

export function recentMessages(messages: Message[]): Message[] {
  const result: Message[] = [];
  let length = 0;
  for (const m of messages.slice(-24).reverse()) {
    const content = m.content.slice(-4000);
    if (length + content.length > 20000) break;
    if (content.trim()) {
      result.unshift({ role: m.role, content });
      length += content.length;
    }
  }
  return result;
}

type CallEvents = {
  onReady: () => void;
  onStream: (stream: MediaStream | null) => void;
  onOutputStream?: (stream: MediaStream | null) => void;
  onTranscript: (
    role: Message["role"],
    delta: string,
    start: number,
    end: number,
  ) => void;
  onThinking: (thinking: boolean) => void;
  onEvidence: (reply: EveReply) => void;
  onError: (message: string) => void;
  onClosed: () => void;
  getMessages: () => Message[];
};

// WebRTC owns the audio. Only scoped context and transcripts reach our server.
export class EveCall {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audio = new Audio();
  private cancel = new AbortController();
  private closed = false;
  private closing = false;
  private ready = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private delegations = new Set<string>();
  private pending = 0;
  private scope: EveScope;
  private events: CallEvents;
  constructor(scope: EveScope, events: CallEvents) {
    this.scope = scope;
    this.events = events;
  }

  private send(
    type: string,
    content?: string,
    delegation_id: string | null = null,
  ) {
    if (this.channel?.readyState !== "open" || this.closed) return;
    this.channel.send(
      JSON.stringify({
        type,
        event_id: crypto.randomUUID(),
        ...(content === undefined ? {} : { content, delegation_id }),
      }),
    );
  }

  async start() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
        throw new Error(
          "Voice isn’t supported in this browser. You can still type to Eve.",
        );
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (this.closed) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      this.mic = mic;
      this.events.onStream(mic);
      mic.getAudioTracks().forEach((t) => {
        t.onended = () =>
          this.fail(
            "Microphone disconnected. You can reconnect or type to Eve.",
          );
      });
      const pc = (this.pc = new RTCPeerConnection());
      pc.ontrack = ({ track }) => {
        const output = new MediaStream([track]);
        this.audio.srcObject = output;
        this.events.onOutputStream?.(output);
        void this.audio
          .play()
          .catch(() =>
            this.fail(
              "Audio playback was blocked. Try the call again in your browser.",
            ),
          );
      };
      pc.onconnectionstatechange = () => {
        if (
          ["failed", "disconnected"].includes(pc.connectionState) &&
          !this.closing
        )
          this.fail(
            "The voice connection was interrupted. Your conversation is still here.",
          );
      };
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));
      const channel = (this.channel = pc.createDataChannel("oai-events"));
      channel.onmessage = (e) => {
        try {
          this.receive(JSON.parse(e.data));
        } catch {
          this.fail("An unreadable voice event interrupted the call.");
        }
      };
      channel.onclose = () => {
        if (!this.closed)
          this.fail("Voice disconnected before finalisation was confirmed.");
      };
      channel.onerror = () =>
        this.fail("The voice connection failed. Please reconnect.");
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise<void>((resolve, reject) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const done = () => {
          pc.removeEventListener("icegatheringstatechange", check);
          clearTimeout(timer);
          this.cancel.signal.removeEventListener("abort", aborted);
        };
        const check = () => {
          if (pc.iceGatheringState === "complete") {
            done();
            resolve();
          }
        };
        const aborted = () => {
          done();
          reject(new DOMException("Closed", "AbortError"));
        };
        const timer = setTimeout(() => {
          done();
          reject(new Error("Voice connection timed out. Please try again."));
        }, 10000);
        pc.addEventListener("icegatheringstatechange", check);
        this.cancel.signal.addEventListener("abort", aborted, { once: true });
        if (this.cancel.signal.aborted) aborted();
      });
      if (this.closed) return;
      const answer = await evePost<{ sdp: string }>(
        "voice",
        {
          ...this.scope,
          sdp: pc.localDescription?.sdp,
          messages: recentMessages(this.events.getMessages()),
        },
        this.cancel.signal,
      );
      if (this.closed) return;
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      this.timers.push(
        setTimeout(() => {
          if (!this.ready)
            this.fail(
              "OpenAI did not start the voice session. Please try again.",
            );
        }, 15000),
      );
    } catch (error) {
      if (!this.closed)
        this.fail(
          (error as Error).name === "NotAllowedError"
            ? "Microphone access was declined. You can still type to Eve."
            : (error as Error).message,
        );
    }
  }

  private receive(event: any) {
    if (this.closed) return;
    if (event.type === "session.closed") {
      this.dispose();
      return;
    }
    if (this.closing) return;
    if (event.type === "session.started") {
      this.ready = true;
      this.events.onReady();
      this.send(
        "session.instructions.append",
        "Greet the caller now in English. Briefly introduce yourself as Eve, their AI support assistant, then ask how you can help and listen.",
      );
      // Bound a forgotten demo call. Starting again is always explicit.
      this.timers.push(
        setTimeout(() => {
          this.events.onError(
            "The five-minute demo call has ended. Start another call to continue.",
          );
          this.end();
        }, 300000),
      );
    } else if (
      event.type === "session.input_transcript.delta" ||
      event.type === "session.output_transcript.delta"
    ) {
      if (typeof event.delta === "string")
        this.events.onTranscript(
          event.type.includes("input_") ? "user" : "assistant",
          event.delta,
          event.start_ms,
          event.end_ms,
        );
    } else if (
      event.type === "session.delegation.created" &&
      event.delegation?.target === "client"
    ) {
      void this.delegate(event.delegation.id);
    } else if (event.type === "error") {
      this.fail(
        "OpenAI couldn’t continue this voice session. Please reconnect or use chat.",
      );
    }
  }

  private async delegate(id: string) {
    if (!id || this.delegations.has(id)) return;
    this.delegations.add(id);
    this.pending++;
    this.events.onThinking(true);
    try {
      const messages = recentMessages(this.events.getMessages());
      // Full-duplex speech can finish an assistant fragment after the user's question.
      let lastUser = messages.length - 1;
      while (lastUser >= 0 && messages[lastUser].role !== "user") lastUser--;
      if (lastUser < 0) {
        this.send(
          "session.commentary.append",
          "I didn’t catch your question. Could you say it again?",
          id,
        );
        return;
      }
      const reply = await evePost<EveReply>(
        "chat",
        { ...this.scope, messages: messages.slice(0, lastUser + 1) },
        this.cancel.signal,
      );
      if (this.closed || this.closing) return;
      this.events.onEvidence(reply);
      // GPT-Live append content has a 500-token limit. Bound to 1,000 characters.
      this.send("session.commentary.append", spokenAnswer(reply.text), id);
    } catch {
      if (!this.closed && !this.closing)
        this.send(
          "session.commentary.append",
          "I couldn’t refresh your records. Please try again; I won’t guess your account status.",
          id,
        );
    } finally {
      this.pending--;
      if (!this.closed) this.events.onThinking(this.pending > 0);
    }
  }

  async refreshContext() {
    if (!this.ready || this.closing || this.closed) return;
    try {
      const data = await evePost<{ brief: string }>(
        "context",
        this.scope,
        this.cancel.signal,
      );
      if (!this.closing) this.send("session.thinking.append", data.brief);
    } catch {
      if (!this.closed)
        this.events.onError(
          "The latest account context could not be refreshed.",
        );
    }
  }
  mute(muted: boolean) {
    this.mic?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }
  end() {
    if (this.closed || this.closing) return;
    if (!this.ready) {
      this.dispose();
      return;
    }
    this.closing = true;
    this.mic?.getTracks().forEach((t) => {
      t.enabled = false;
    });
    this.send("session.close");
    this.timers.push(
      setTimeout(() => {
        this.events.onError(
          "Call ended locally; OpenAI finalisation was not confirmed.",
        );
        this.dispose();
      }, 5000),
    );
  }
  private fail(message: string) {
    if (!this.closed) {
      this.events.onError(message);
      this.dispose();
    }
  }
  dispose() {
    if (this.closed) return;
    if (!this.closing && this.ready) this.send("session.close");
    this.closed = true;
    this.cancel.abort();
    this.timers.forEach(clearTimeout);
    this.mic?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.audio.pause();
    this.audio.srcObject = null;
    this.channel?.close();
    this.pc?.close();
    this.events.onStream(null);
    this.events.onOutputStream?.(null);
    this.events.onThinking(false);
    this.events.onClosed();
  }
}
