import { test } from "node:test";
import assert from "node:assert/strict";
import { EveCall, recentMessages } from "../src/eve-client.ts";

function browserFixture(t: any, getUserMedia: () => Promise<unknown>) {
  const globals: Record<string, unknown> = {
    Audio: class {
      srcObject = null;
      pause() {}
    },
    navigator: { mediaDevices: { getUserMedia } },
    window: { RTCPeerConnection: class {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() =>
      descriptor
        ? Object.defineProperty(globalThis, key, descriptor)
        : Reflect.deleteProperty(globalThis, key),
    );
  }
}
function events() {
  const state = { closed: 0, errors: [] as string[], streams: [] as unknown[] };
  return {
    state,
    callbacks: {
      onReady() {},
      onStream(s: unknown) {
        state.streams.push(s);
      },
      onTranscript() {},
      onThinking() {},
      onEvidence() {},
      onError(message: string) {
        state.errors.push(message);
      },
      onClosed() {
        state.closed++;
      },
      getMessages() {
        return [];
      },
    },
  };
}

test("leaving Eve while microphone permission is pending stops any late stream", async (t) => {
  let resolveMic!: (s: unknown) => void;
  browserFixture(
    t,
    () =>
      new Promise((resolve) => {
        resolveMic = resolve;
      }),
  );
  const { state, callbacks } = events();
  let stopped = 0;
  const call = new EveCall({ sessionId: "test", person: "maya" }, callbacks);
  const start = call.start();
  call.dispose();
  resolveMic({ getTracks: () => [{ stop: () => stopped++ }] });
  await start;
  assert.equal(stopped, 1);
  assert.equal(state.closed, 1);
  assert.deepEqual(state.streams, [null]);
  assert.deepEqual(state.errors, []);
});

test("denied microphone permission gives a recoverable error and closes once", async (t) => {
  browserFixture(t, async () => {
    throw new DOMException("Permission denied", "NotAllowedError");
  });
  const { state, callbacks } = events();
  const call = new EveCall({ sessionId: "test", person: "maya" }, callbacks);
  await call.start();
  call.dispose();
  assert.equal(state.closed, 1);
  assert.match(state.errors[0], /still type/);
});

test("long voice transcripts stay within the server history limits", () => {
  const result = recentMessages(
    Array.from({ length: 50 }, (_, n) => ({
      role: n % 2 ? ("assistant" as const) : ("user" as const),
      content: `${n}:` + "x".repeat(4500),
    })),
  );
  assert.ok(result.length <= 24);
  assert.ok(result.every((m) => m.content.length <= 4000));
  assert.ok(result.reduce((total, m) => total + m.content.length, 0) <= 20000);
});

test('demo scope is pinned even when the displayed moment is the latest', async()=>{
 const {eveScope, spokenAnswer}=await import('../src/eve-client.ts');
 assert.deepEqual(eveScope({session:{id:'pinned'},cutoff:4,historical:false} as any,'sam'),{sessionId:'pinned',person:'sam',at:4});
 assert.equal(spokenAnswer('The line is restored. Your callback is still due.'),'The line is restored. Your callback is still due.');
 const long='Your connection is restored. '.repeat(80)+'But the case is not closed.';
 assert.ok(spokenAnswer(long).length<=1000);assert.match(spokenAnswer(long),/full answer.*conversation/i);
 assert.doesNotMatch(spokenAnswer(long),/Your connection is restored/);
});
