import { networkInterfaces } from "node:os";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const grace = Number(process.env.DISCONNECT_GRACE_SECONDS ?? 60);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT: 1~65535 사이의 정수가 필요합니다.");
if (!Number.isSafeInteger(grace) || grace < 1 || grace > 86400) throw new Error("DISCONNECT_GRACE_SECONDS: 1~86400 사이의 정수가 필요합니다.");
const app = createApp({ graceMs: grace * 1000 });
app.server.on("error", error => { console.error(error.message); process.exit(1); });
app.server.listen(port, host, () => {
  console.log(`Yacht Dice: http://localhost:${port}`);
  if (host === "0.0.0.0") for (const entries of Object.values(networkInterfaces())) for (const ip of entries ?? []) {
    if (ip.family === "IPv4" && !ip.internal) console.log(`LAN: http://${ip.address}:${port}`);
  }
  console.log(`재접속 대기 ${grace}초 · 비활성/종료 방 보관 30초`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
