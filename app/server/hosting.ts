export const hosted = process.env.VERCEL === "1";
export function requestOriginAllowed(
  origin: string | undefined,
  host: string,
  remote: boolean,
  port = 5186,
) {
  if (!origin) return true;
  if (remote) return origin === `https://${host}`;
  return [
    `http://127.0.0.1:5185`,
    `http://localhost:5185`,
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ].includes(origin);
}
