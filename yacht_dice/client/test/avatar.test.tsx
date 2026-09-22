import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AvatarPicker } from "../src/components/AvatarPicker";
import { AvatarImage } from "../src/components/AvatarImage";
import { loadAvatar, saveAvatar, createAvatar } from "../src/network/avatar";

test("preset picker exposes names, selection, file types and processing lock", () => {
  const html = renderToStaticMarkup(
    <AvatarPicker
      avatar={{ kind: "preset", id: "teal" }}
      hasSelection={true}
      disabled={true}
      message="처리 중"
      onSelect={() => {}}
      onUpload={async () => false}
    />,
  );
  assert.equal((html.match(/aria-pressed=/g) ?? []).length, 6);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(html, /image\/png,image\/jpeg,image\/webp/);
  assert.match(html, /fieldset[^>]*disabled/);
  assert.match(html, /role="status"/);
  assert.match(renderToStaticMarkup(<AvatarImage />), /aria-hidden="true"/);
});

test("unavailable browser storage is nonfatal and invalid uploads are rejected", async () => {
  assert.equal(await loadAvatar(), undefined);
  assert.equal(await saveAvatar({ kind: "preset", id: "teal" }), false);
  await assert.rejects(
    createAvatar(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" })),
  );
  await assert.rejects(
    createAvatar(new File([], "a.png", { type: "image/png" })),
  );
  await assert.rejects(
    createAvatar(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.png", {
        type: "image/png",
      }),
    ),
  );
});
