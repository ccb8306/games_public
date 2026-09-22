import { avatarSchema, type Avatar } from "@yacht/shared";

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("yacht-profile", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("preferences");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("프로필 저장소를 열 수 없습니다."));
  });
}

export async function loadAvatar(): Promise<Avatar | undefined> {
  try {
    const db = await database();
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction("preferences");
        const request = tx.objectStore("preferences").get("avatar");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const parsed = avatarSchema.safeParse(value);
      return parsed.success ? parsed.data : undefined;
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}

export async function saveAvatar(avatar: Avatar): Promise<boolean> {
  try {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("preferences", "readwrite");
        tx.objectStore("preferences").put(avatar, "avatar");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

export async function createAvatar(file: File): Promise<Avatar> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024 ||
    file.size === 0
  )
    throw new Error("5MB 이하의 PNG, JPEG, WebP 이미지를 선택하세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 16_000_000
    )
      throw new Error("1600만 픽셀 이하의 이미지를 선택하세요.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("이 브라우저에서는 이미지 변환을 사용할 수 없습니다.");
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      128,
      128,
    );
    const parsed = avatarSchema.safeParse({
      kind: "upload",
      dataUrl: canvas.toDataURL("image/png"),
    });
    if (!parsed.success)
      throw new Error(
        "이미지를 변환하지 못했습니다. 다른 이미지를 선택하세요.",
      );
    return parsed.data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
