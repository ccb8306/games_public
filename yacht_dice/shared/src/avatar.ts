import { z } from "zod";

export const AVATAR_IDS = ["coral", "amber", "lime", "teal", "blue", "violet"] as const;
export const MAX_AVATAR_BYTES = 96 * 1024;
export const DEFAULT_AVATAR = { kind: "preset", id: "teal" } as const;

// Only bounded 128px PNGs are accepted; URLs and active formats never enter state.
export function isAvatarPng(value: string): boolean {
  const prefix = "data:image/png;base64,";
  if (!value.startsWith(prefix)) return false;
  const encoded = value.slice(prefix.length);
  if (encoded.length > MAX_AVATAR_BYTES * 4 / 3 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return false;
  try {
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    if (bytes.length < 57 || bytes.length > MAX_AVATAR_BYTES) return false;
    if (![137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) return false;
    const view = new DataView(bytes.buffer);
    let pos = 8, hasData = false;
    while (pos + 12 <= bytes.length) {
      const size = view.getUint32(pos);
      const type = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
      if (size > bytes.length - pos - 12) return false;
      let crc = 0xffffffff;
      for (let i = pos + 4; i < pos + 8 + size; i++) {
        crc ^= bytes[i]!;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(pos + 8 + size)) return false;
      if (["acTL", "fcTL", "fdAT"].includes(type)) return false;
      if (pos === 8 && (type !== "IHDR" || size !== 13 ||
          view.getUint32(pos + 8) !== 128 || view.getUint32(pos + 12) !== 128)) return false;
      if (pos !== 8 && type === "IHDR") return false;
      if (type === "IDAT") hasData = true;
      if (type === "IEND") return size === 0 && hasData && pos + 12 === bytes.length;
      pos += size + 12;
    }
    return false;
  } catch { return false; }
}

export const avatarSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("preset"), id: z.enum(AVATAR_IDS) }),
  z.strictObject({ kind: z.literal("upload"), dataUrl: z.string().max(MAX_AVATAR_BYTES * 4 / 3 + 22).refine(isAvatarPng) }),
]);
export type Avatar = z.infer<typeof avatarSchema>;
