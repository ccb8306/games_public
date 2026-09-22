import { deflateSync } from "node:zlib";
import { randomBytes } from "node:crypto";
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write(type, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
  return result;
}
export function avatarPng(noisy = false) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(128, 0); header.writeUInt32BE(128, 4);
  header[8] = 8; header[9] = 6;
  const pixels = noisy ? randomBytes(128 * 513) : Buffer.alloc(128 * 513, 255);
  for (let row = 0; row < 128; row++) pixels[row * 513] = 0;
  return "data:image/png;base64," + Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}
