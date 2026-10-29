import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { MAX_MESSAGE_BYTES } from "@yacht/shared";
import { Rooms } from "./rooms.js";

export function createApp(options: { graceMs?: number; now?: () => number } = {}) {
  const rooms = new Rooms(options.graceMs, options.now);
  const publicRoot = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
  const server = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (pathname === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ status: "ok" })); return; }
    const file = resolve(publicRoot, pathname === "/" ? "index.html" : `.${pathname}`);
    if (!file.startsWith(resolve(publicRoot) + sep)) { res.writeHead(403); res.end(); return; }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream", "x-content-type-options": "nosniff", "cache-control": "no-cache" });
      if (req.method === "HEAD") { res.end(); return; }
      createReadStream(file).on("error", () => res.destroy()).pipe(res);
    } catch { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("페이지가 없습니다. 먼저 npm run build를 실행해주세요."); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  server.on("upgrade", (request, socket, head) => {
    let validOrigin = true;
    try { if (request.headers.origin) validOrigin = new URL(request.headers.origin).host === request.headers.host; } catch { validOrigin = false; }
    if (request.url !== "/ws" || !validOrigin) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, ws => wss.emit("connection", ws, request));
  });
  const alive = new WeakSet<object>();
  wss.on("connection", ws => {
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));
    ws.on("message", (raw, binary) => {
      if (binary) { ws.close(1003, "Text messages only"); return; }
      rooms.handle(ws, raw.toString());
    });
    ws.on("close", () => rooms.disconnected(ws));
    ws.on("error", () => ws.terminate());
  });
  const sweep = setInterval(() => rooms.tick(), 250);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) ws.terminate();
      else { alive.delete(ws); ws.ping(); }
    }
  }, 15_000);
  server.on("close", () => { clearInterval(sweep); clearInterval(heartbeat); });
  async function close() {
    clearInterval(sweep); clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    await rooms.close();
    await new Promise<void>(resolveClose => server.close(() => resolveClose()));
  }
  return { server, rooms, close };
}
