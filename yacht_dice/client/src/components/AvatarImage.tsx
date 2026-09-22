import { useState } from "react";
import { DEFAULT_AVATAR, type Avatar } from "@yacht/shared";

const colors = {
  coral: "#e77d72",
  amber: "#d5a943",
  lime: "#95af61",
  teal: "#559c91",
  blue: "#6a95c8",
  violet: "#aa85be",
};

export function AvatarImage({ avatar = DEFAULT_AVATAR }: { avatar?: Avatar }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (avatar.kind === "upload" && failed !== avatar.dataUrl)
    return (
      <img
        className="profile-avatar"
        src={avatar.dataUrl}
        alt=""
        width={36}
        height={36}
        onError={() => setFailed(avatar.dataUrl)}
      />
    );
  const id = avatar.kind === "preset" ? avatar.id : DEFAULT_AVATAR.id;
  return (
    <svg className="profile-avatar" viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="16" fill={colors[id]} />
      <circle cx="24" cy="18" r="8" fill="#fff" />
      <path d="M9 43c0-17 30-17 30 0" fill="#fff" />
    </svg>
  );
}
