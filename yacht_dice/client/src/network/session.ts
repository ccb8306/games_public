export type Session = {
  code: string;
  token: string;
  playerId: string;
  roomId: string;
};
const storageKey = "yacht.session";
export function readSession(): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    return value &&
      [value.code, value.token, value.playerId, value.roomId].every(
        (v) => typeof v === "string",
      )
      ? value
      : null;
  } catch {
    return null;
  }
}

export function writeSession(value: Session | null): void {
  try {
    if (value) {
      const { code, token, playerId, roomId } = value;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ code, token, playerId, roomId }),
      );
    } else sessionStorage.removeItem(storageKey);
  } catch {
    // Storage may be disabled. The current connection remains usable until reload.
  }
}
