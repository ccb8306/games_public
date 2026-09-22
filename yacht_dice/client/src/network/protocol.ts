import type { ClientMessage } from "@yacht/shared";

// Distributive omission preserves the discriminator and each command's required fields.
type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type Command = Without<
  Exclude<ClientMessage, { type: "sendChat" }>,
  "requestId"
>;
export type RoomAction = Without<
  Extract<ClientMessage, { expectedRevision: number }>,
  "requestId" | "roomId" | "expectedRevision"
>;

export function requestId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 15) | 64;
  b[8] = (b[8]! & 63) | 128;
  const s = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export function socketUrl(
  address: Pick<Location, "protocol" | "host">,
): string {
  return `${address.protocol === "https:" ? "wss" : "ws"}://${address.host}/ws`;
}
