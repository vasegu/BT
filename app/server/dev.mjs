import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--watch", "server/server.ts"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5185",
      "--strictPort",
    ],
    { stdio: "inherit" },
  ),
];
let stopping = false;
function close(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((p) => p.kill("SIGTERM"));
  process.exitCode = code;
}
children.forEach((p) => {
  p.on("error", (error) => {
    console.error(error);
    close(1);
  });
  p.on("exit", (code) => {
    if (!stopping) close(code || 1);
  });
});
process.on("SIGINT", () => close());
process.on("SIGTERM", () => close());
