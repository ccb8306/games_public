import { useRef, useState } from "react";

export function roomInviteUrl(code: string, address: string) {
  const url = new URL(address);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", code);
  return url.href;
}

/** LAN HTTP may not expose Clipboard API; retain an explicit manual fallback. */
export async function copyInviteUrl(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Permission rejection can still allow a user-initiated legacy copy.
  }
  const previous = document.activeElement;
  const input = document.createElement("textarea");
  input.value = value;
  input.readOnly = true;
  input.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.append(input);
  try {
    input.select();
    return document.execCommand?.("copy") === true;
  } catch {
    return false;
  } finally {
    input.remove();
    if (previous instanceof window.HTMLElement) previous.focus();
  }
}

export function RoomInvite({
  code,
  compact = false,
}: {
  code: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const invite =
    typeof location === "undefined"
      ? `?room=${encodeURIComponent(code)}`
      : roomInviteUrl(code, location.href ?? `${location.origin}/`);
  async function copy() {
    if (pending.current) return;
    pending.current = true;
    setStatus("copying");
    const copied = await copyInviteUrl(invite);
    pending.current = false;
    setStatus(copied ? "copied" : "failed");
    if (!copied) input.current?.select();
  }
  return (
    <div className={`room-invite ${compact ? "compact" : ""}`}>
      <div className="join">
        {(!compact || status === "failed") && (
          <input
            ref={input}
            aria-label="초대 링크"
            readOnly
            value={invite}
            onFocus={(event) => event.target.select()}
          />
        )}
        <button
          type="button"
          disabled={status === "copying"}
          onClick={() => void copy()}
        >
          {status === "copied"
            ? "복사됨"
            : status === "copying"
              ? "복사 중…"
              : "방 URL 복사"}
        </button>
      </div>
      <span role="status">
        {status === "failed"
          ? "자동 복사에 실패했어요. 위 링크를 선택해 직접 복사해주세요."
          : status === "copied"
            ? "방 URL을 복사했어요."
            : ""}
      </span>
    </div>
  );
}
