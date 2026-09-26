import { waitUntil } from "@vercel/functions";
import { hosted, requestOriginAllowed } from "./hosting.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { parseEnv } from "node:util";
import { memoryAtlas } from "./memory-atlas.ts";
import { PostgresRepository } from "./postgres-repository.ts";
import { database } from "./database.ts";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ContextEvals, summariseEvaluation } from "./context-evals.ts";
import {
  buildHodoscope,
  explorerPath,
  explorerStatus,
} from "./hodoscope-export.ts";
import { agentReview, reviewExplorerPath } from "./agent-review.ts";
import { behaviourSpace } from "./behaviour.ts";
import { Engine, DomainError } from "./engine.ts";
import { assessmentConfig, evaluateJev } from "./assessment.ts";
import {
  eveConfig,
  eveContext,
  parseEveRequest,
  replyToEve,
  createEveVoice,
  voiceBrief,
} from "./eve.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.BT_PORT || 5186);
const dataRoot = hosted ? "/tmp/bt" : resolve(root, ".data");
const dbPath = process.env.BT_DB_PATH || resolve(dataRoot, "bt.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const localDatabaseConfig = existsSync(resolve(root, ".env.database.local"))
  ? parseEnv(readFileSync(resolve(root, ".env.database.local"), "utf8"))
  : {};
const storage = hosted
  ? "supabase"
  : process.env.BT_STORAGE || localDatabaseConfig.BT_STORAGE || "sqlite";
const engine =
  storage === "supabase"
    ? new PostgresRepository(database())
    : new Engine(dbPath);
const evalDb =
  engine instanceof Engine
    ? engine.db
    : new DatabaseSync(resolve(dataRoot, "hosted-evals.sqlite"));
const contextEvals = new ContextEvals(evalDb);
const getEveConfig = () => eveConfig(resolve(root, ".env.local"));
let eveRequests = 0;
export async function runWorker(sessionId?: string) {
  const config = assessmentConfig(resolve(root, ".env.local"));
  await engine.processJobs(
    config.key && process.env.BT_ARBITER_MODE !== "rules"
      ? (request) => evaluateJev(request, config)
      : undefined,
    sessionId,
  );
}
const worker =
  hosted || process.env.BT_DISABLE_WORKER === "1"
    ? undefined
    : setInterval(() => {
        void runWorker().catch(() =>
          console.error("Arbiter worker could not complete a job."),
        );
      }, 350);
function scheduleWorker(sessionId: string) {
  if (hosted && process.env.BT_DISABLE_WORKER !== "1")
    waitUntil(
      runWorker(sessionId).catch(() =>
        console.error("Hosted worker failed; durable job retained."),
      ),
    );
}
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};
export async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  const send = (status: number, data: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  try {
    const host = req.headers.host || "";
    if (!hosted && !/^(127\.0\.0\.1|localhost):\d+$/.test(host))
      throw new DomainError("Localhost access only", 403);
    const url = new URL(req.url || "/", `http://${host}`);
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "GET") {
        if (url.pathname === "/api/health")
          return send(200, {
            store: storage,
            arbiter:
              process.env.BT_ARBITER_MODE !== "rules" &&
              assessmentConfig(resolve(root, ".env.local")).key
                ? "jev_configured"
                : "rules",
            worker: hosted
              ? "request_backed"
              : process.env.BT_DISABLE_WORKER === "1"
                ? "disabled"
                : "running",
            model: getEveConfig().key ? "eve_configured" : "not_connected",
            externalActions: "simulated",
          });
        if (url.pathname === "/api/eve/status") {
          const config = getEveConfig();
          return send(200, {
            configured: Boolean(config.key.trim()),
            textModel: config.textModel,
            voiceModel: "gpt-live-1",
          });
        }
        if (
          url.pathname === "/api/context-evals" ||
          url.pathname === "/api/context-evals/explorer"
        ) {
          const id = url.searchParams.get("session");
          if (!id) throw new DomainError("Session is required");
          const snapshot = await engine.snapshot(
            id,
            url.searchParams.has("at")
              ? Number(url.searchParams.get("at"))
              : undefined,
          );
          const suite = snapshot.cutoff >= 1 ? contextEvals.get(id) : null;
          if (url.pathname.endsWith("/explorer")) {
            if (!suite || !existsSync(explorerPath(suite)))
              throw new DomainError(
                "The native Hodoscope explorer is not ready.",
                409,
              );
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            });
            return res.end(readFileSync(explorerPath(suite)));
          }
          return send(200, {
            suite,
            summary: suite ? summariseEvaluation(suite) : [],
            explorer: Boolean(suite && explorerStatus(suite) === "ready"),
            exportStatus: suite ? explorerStatus(suite) : "unavailable",
            map:
              suite &&
              existsSync(
                resolve(dirname(explorerPath(suite)), "projection.json"),
              )
                ? JSON.parse(
                    readFileSync(
                      resolve(dirname(explorerPath(suite)), "projection.json"),
                      "utf8",
                    ),
                  )
                : null,
          });
        }
        if (
          url.pathname === "/api/agent-review" ||
          url.pathname === "/api/agent-review/explorer"
        ) {
          const id = url.searchParams.get("session");
          if (!id) throw new DomainError("Session is required");
          const snapshot = await engine.snapshot(
            id,
            url.searchParams.has("at")
              ? Number(url.searchParams.get("at"))
              : undefined,
          );
          const history = await Promise.all(
            Array.from({ length: snapshot.cutoff + 1 }, (_, at) =>
              engine.snapshot(id, at),
            ),
          );
          const review = await agentReview(snapshot, (at) => history[at]);
          if (url.pathname.endsWith("/explorer")) {
            const path = reviewExplorerPath(review.fingerprint);
            if (!review.map || !existsSync(path))
              throw new DomainError(
                "Not enough recorded runs for an explorer.",
                409,
              );
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            });
            return res.end(readFileSync(path));
          }
          return send(200, review);
        }
        if (url.pathname === "/api/behaviour-space") {
          const id = url.searchParams.get("session");
          if (!id) throw new DomainError("Session is required");
          const snapshot = await engine.snapshot(
            id,
            url.searchParams.has("at")
              ? Number(url.searchParams.get("at"))
              : undefined,
          );
          try {
            const history = await Promise.all(
              Array.from({ length: snapshot.cutoff + 1 }, (_, at) =>
                engine.snapshot(id, at),
              ),
            );
            return send(
              200,
              await behaviourSpace(snapshot, (at) => history[at]),
            );
          } catch {
            throw new DomainError(
              "The local behaviour encoder or projection runtime is unavailable. The action and outcome ledger is still available.",
              503,
            );
          }
        }
        if (
          url.pathname === "/api/memory-space" &&
          engine instanceof PostgresRepository
        ) {
          const id = url.searchParams.get("session");
          if (!id) throw new DomainError("Session required");
          const snap = await engine.snapshot(
            id,
            Number(url.searchParams.get("at")),
          );
          const c = (await engine.contexts(id, snap.cutoff)).find(
            (c) => c.household.id === url.searchParams.get("person"),
          );
          if (!c) throw new DomainError("Customer not found", 404);
          return send(200, await memoryAtlas(c, snap.events));
        }
        if (
          url.pathname === "/api/data-context" &&
          engine instanceof PostgresRepository
        ) {
          const id = url.searchParams.get("session");
          if (!id) throw new DomainError("Session required");
          const snap = await engine.snapshot(
            id,
            url.searchParams.has("at")
              ? Number(url.searchParams.get("at"))
              : undefined,
          );
          const contexts = await engine.contexts(id, snap.cutoff);
          return send(200, {
            store: storage,
            contexts,
            sourceCount: snap.events.length,
          });
        }
        if (url.pathname === "/api/snapshot") {
          const id = url.searchParams.get("session");
          if (!id) throw new DomainError("Session is required");
          scheduleWorker(id);
          return send(
            200,
            await engine.snapshot(
              id,
              url.searchParams.has("at")
                ? Number(url.searchParams.get("at"))
                : undefined,
            ),
          );
        }
        throw new DomainError("Endpoint not found", 404);
      }
      if (req.method !== "POST")
        throw new DomainError("Method not allowed", 405);
      const origin = req.headers.origin;
      if (!requestOriginAllowed(origin, host, hosted, port))
        throw new DomainError("Cross-origin mutation rejected", 403);
      if (
        req.headers["sec-fetch-site"] === "cross-site" ||
        req.headers["x-bt-demo"] !== "1"
      )
        throw new DomainError("Local presenter header required", 403);
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new DomainError("JSON body required", 415);
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString();
        if (
          Buffer.byteLength(body) >
          (url.pathname.startsWith("/api/eve/") ? 65536 : 8192)
        )
          throw new DomainError("Request too large", 413);
      }
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(body || "{}");
      } catch {
        throw new DomainError("Invalid JSON");
      }
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new DomainError("Expected an object");
      if (
        ["/api/eve/chat", "/api/eve/voice", "/api/eve/context"].includes(
          url.pathname,
        )
      ) {
        const input = parseEveRequest(value);
        const context = eveContext(
          await engine.snapshot(input.sessionId, input.at),
          input.person,
        );
        if (url.pathname === "/api/eve/context")
          return send(200, {
            revision: context.revision,
            brief: voiceBrief(context),
          });
        if (
          url.pathname === "/api/eve/chat" &&
          (!input.messages.length || input.messages.at(-1)?.role !== "user")
        )
          throw new DomainError("A customer message is required");
        if (eveRequests >= 4)
          throw new DomainError("Eve is busy. Please try again shortly.", 429);
        const cancel = new AbortController();
        const disconnected = () => cancel.abort();
        res.on("close", disconnected);
        eveRequests++;
        try {
          const result =
            url.pathname === "/api/eve/chat"
              ? await replyToEve(
                  context,
                  input.messages,
                  getEveConfig(),
                  fetch,
                  cancel.signal,
                )
              : await createEveVoice(
                  context,
                  input.messages,
                  value.sdp,
                  getEveConfig(),
                  fetch,
                  cancel.signal,
                );
          if (
            url.pathname === "/api/eve/chat" &&
            engine instanceof PostgresRepository &&
            "text" in result
          ) {
            await engine.saveConversation(
              input.sessionId,
              input.person,
              context.revision,
              [
                input.messages.at(-1)!,
                { role: "assistant", content: result.text as string },
              ],
            );
          }
          if (!res.destroyed) return send(200, result);
          return;
        } finally {
          eveRequests--;
          res.off("close", disconnected);
        }
      }
      if (url.pathname === "/api/context-evals") {
        if (hosted)
          throw new DomainError(
            "Controlled evaluation batches run in the local presenter; their SQLite/Python artefacts are not durable on Vercel.",
            503,
          );
        if (typeof value.sessionId !== "string")
          throw new DomainError("Session is required");
        const config = assessmentConfig(resolve(root, ".env.local"));
        if (!config.key.trim())
          throw new DomainError(
            "Configure the AI Gateway key before running a model evaluation.",
            503,
          );
        const snapshot = await engine.snapshot(value.sessionId, 1);
        const suite = contextEvals.start(snapshot, (request) =>
          evaluateJev(request, config),
        );
        void contextEvals
          .finished()
          .then(() => {
            const complete = contextEvals.get(snapshot.session.id);
            if (complete?.status === "complete")
              return buildHodoscope(complete);
          })
          .catch(() =>
            console.error(
              "Native Hodoscope export is unavailable; recorded evaluations are still inspectable.",
            ),
          );
        return send(202, {
          suite,
          summary: summariseEvaluation(suite),
          explorer: explorerStatus(suite) === "ready",
          exportStatus: explorerStatus(suite),
        });
      }
      if (url.pathname === "/api/scenarios")
        return send(
          201,
          await (engine instanceof PostgresRepository
            ? engine.createSession(
                typeof value.variant === "string" ? value.variant : undefined,
              )
            : engine.createSession()),
        );
      if (url.pathname === "/api/events") {
        if (
          typeof value.sessionId !== "string" ||
          typeof value.step !== "string" ||
          typeof value.idempotencyKey !== "string" ||
          typeof value.revision !== "number"
        )
          throw new DomainError(
            "sessionId, step, idempotencyKey and revision are required",
          );
        const advanced = await engine.advance(
          value.sessionId,
          value.step,
          value.idempotencyKey,
          value.revision,
        );
        scheduleWorker(value.sessionId);
        return send(202, advanced);
      }
      throw new DomainError("Endpoint not found", 404);
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      throw new DomainError("Method not allowed", 405);
    const reference = url.pathname.startsWith("/reference/");
    const base = reference ? resolve(root, "../docs") : resolve(root, "dist");
    const pathname = decodeURIComponent(
      reference
        ? url.pathname.slice("/reference/".length)
        : url.pathname.slice(1),
    );
    let path = resolve(base, pathname || "index.html");
    if (path !== base && !path.startsWith(base + sep))
      throw new DomainError("Invalid path", 403);
    if (existsSync(path) && statSync(path).isDirectory())
      path = resolve(path, "index.html");
    if (!existsSync(path)) {
      if (reference || extname(path))
        throw new DomainError("File not found", 404);
      path = resolve(base, "index.html");
    }
    if (!existsSync(path))
      throw new DomainError(
        "Run npm run build, or open the development app on port 5185.",
        404,
      );
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : readFileSync(path));
  } catch (error) {
    if (error instanceof DomainError)
      return send(error.status, { error: error.message });
    console.error(error);
    send(500, {
      error:
        "The runtime could not complete this request. Your persisted session is retained.",
    });
  }
}
if (!hosted) {
  const server = createServer(handler);
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `BT runtime http://127.0.0.1:${port} · ${storage} + worker · external actions simulated`,
    ),
  );
  const close = () => {
    clearInterval(worker);
    server.close(async () => {
      await engine.close();
      if (engine instanceof PostgresRepository) evalDb.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
