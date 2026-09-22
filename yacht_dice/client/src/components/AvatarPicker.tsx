import { AVATAR_IDS, type Avatar } from "@yacht/shared";
import { useId, useRef, useState } from "react";
import { AvatarImage } from "./AvatarImage";

const labels = ["코랄", "골드", "라임", "청록", "파랑", "보라"];
type Props = {
  avatar: Avatar;
  hasSelection: boolean;
  disabled: boolean;
  message: string;
  onSelect: (avatar: Avatar) => void;
  onUpload: (file: File) => Promise<boolean>;
};
export function AvatarPicker({
  avatar,
  hasSelection,
  disabled,
  message,
  onSelect,
  onUpload,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const fileId = useId();
  const hintId = useId();
  return (
    <div className="profile-picker">
      <div className="profile-preview">
        <button
          ref={trigger}
          className="profile-frame"
          type="button"
          disabled={disabled}
          aria-label={
            hasSelection ? "프로필 이미지 변경" : "프로필 이미지 선택"
          }
          aria-haspopup="dialog"
          onClick={() => {
            dialog.current?.showModal();
            setIsOpen(true);
          }}
        >
          {hasSelection ? (
            <AvatarImage avatar={avatar} />
          ) : (
            <span aria-hidden="true">+</span>
          )}
        </button>
        <div>
          <strong>프로필 이미지</strong>
          <p className="muted">
            {hasSelection ? "이미지를 눌러 변경하세요" : "+를 눌러 선택하세요"}
          </p>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="profile-modal"
        aria-labelledby={titleId}
        onClose={() => {
          setIsOpen(false);
          trigger.current?.focus();
        }}
      >
        <div className="profile-modal-heading">
          <h2 id={titleId}>프로필 이미지 선택</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            닫기
          </button>
        </div>
        <fieldset disabled={disabled}>
          <legend>프리셋 선택</legend>
          <div className="profile-options">
            {AVATAR_IDS.map((id, index) => (
              <button
                type="button"
                key={id}
                aria-label={labels[index] + " 프로필"}
                aria-pressed={
                  hasSelection && avatar.kind === "preset" && avatar.id === id
                }
                onClick={() => {
                  onSelect({ kind: "preset", id });
                  dialog.current?.close();
                }}
              >
                <AvatarImage avatar={{ kind: "preset", id }} />
              </button>
            ))}
          </div>
          <label htmlFor={fileId}>내 이미지 선택</label>
          <input
            id={fileId}
            aria-describedby={hintId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file && (await onUpload(file))) dialog.current?.close();
            }}
          />
          <small id={hintId}>
            PNG·JPEG·WebP, 5MB 이하. 중앙을 정사각형으로 잘라 사용합니다.
          </small>
        </fieldset>
        {message && <p role="status">{message}</p>}
      </dialog>
      {message && !isOpen && <p role="status">{message}</p>}
    </div>
  );
}
