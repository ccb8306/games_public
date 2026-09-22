import test from "node:test";
import assert from "node:assert/strict";
import { avatarSchema, isAvatarPng, MAX_AVATAR_BYTES, decodeClientMessage } from "../dist/index.js";
import { randomUUID } from "node:crypto";
import { avatarPng } from "./avatar-fixture.mjs";

test("avatar accepts presets and bounded PNGs but rejects URLs, SVG, malformed or oversized content", () => {
  assert.equal(avatarSchema.safeParse({kind:"preset",id:"teal"}).success, true);
  assert.equal(avatarSchema.safeParse({kind:"preset",id:"unknown"}).success, false);
  assert.equal(isAvatarPng(avatarPng()), true);
  assert.equal(isAvatarPng(avatarPng(true)), true);
  for (const value of ["https://example.com/avatar.png", "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,AAAA", avatarPng().slice(0,-8),
      "data:image/png;base64," + "A".repeat(MAX_AVATAR_BYTES * 2)]) {
    assert.equal(isAvatarPng(value), false);
  }
  const wrongSize = Buffer.from(avatarPng().split(",")[1], "base64");
  wrongSize.writeUInt32BE(10000, 16);
  assert.equal(isAvatarPng("data:image/png;base64," + wrongSize.toString("base64")), false);
  const message = {type:"createRoom",nickname:"A",requestId:randomUUID()};
  assert.equal(decodeClientMessage(JSON.stringify(message)).success,true);
  assert.equal(decodeClientMessage(JSON.stringify({...message,avatar:{kind:"upload",dataUrl:avatarPng(true)}})).success,true);
  assert.equal(decodeClientMessage(JSON.stringify({...message,avatar:{kind:"upload",dataUrl:"bad"}})).success,false);
});
