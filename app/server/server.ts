import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
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
const dbPath = process.env.BT_DB_PATH || resolve(root, ".data/bt.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const engine = new Engine(dbPath);
const getEveConfig = () => eveConfig(resolve(root, ".env.local"));
let eveRequests = 0;
const worker = setInterval(() => {
  const config = assessmentConfig(resolve(root, ".env.local"));
  void engine
    .processJobs(
      config.key ? (request) => evaluateJev(request, config) : undefined,
    )
    .catch(() =>
      console.error("Arbiter worker could not complete a local job."),
    );
}, 350);
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
const server = createServer(async (req, res) => {
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
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host))
      throw new DomainError("Localhost access only", 403);
    const url = new URL(req.url || "/", `http://${host}`);
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "GET") {
        if (url.pathname === "/api/health")
          return send(200, {
            store: "sqlite",
            arbiter: assessmentConfig(resolve(root, ".env.local")).key
              ? "jev_configured"
              : "rules",
            worker: "running",
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
        if (url.pathname === "/api/snapshot") {
          const id = url.searchParams.get("session");
          if (!id) throw new DomainError("Session is required");
          return send(
            200,
            engine.snapshot(
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
      if (
        origin &&
        ![
          "http://127.0.0.1:5185",
          "http://localhost:5185",
          `http://127.0.0.1:${port}`,
          `http://localhost:${port}`,
        ].includes(origin)
      )
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
          engine.snapshot(input.sessionId, input.at),
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
          if (!res.destroyed) return send(200, result);
          return;
        } finally {
          eveRequests--;
          res.off("close", disconnected);
        }
      }
      if (url.pathname === "/api/scenarios")
        return send(201, engine.createSession());
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
        return send(
          202,
          engine.advance(
            value.sessionId,
            value.step,
            value.idempotencyKey,
            value.revision,
          ),
        );
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
        "The local runtime could not complete this request. Your persisted session is retained.",
    });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `BT runtime http://127.0.0.1:${port} · SQLite + worker · external actions simulated`,
  ),
);
const close = () => {
  clearInterval(worker);
  server.close(() => {
    engine.close();
    process.exit(0);
  });
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
