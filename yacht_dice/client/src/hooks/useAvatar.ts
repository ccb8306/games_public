import { useEffect, useRef, useState } from "react";
import { DEFAULT_AVATAR, type Avatar } from "@yacht/shared";
import { createAvatar, loadAvatar, saveAvatar } from "../network/avatar";

export function useAvatar() {
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [hasSelection, setHasSelection] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const version = useRef(0);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    const initial = version.current;
    let active = true;
    void loadAvatar().then((value) => {
      if (active && value && version.current === initial) {
        setAvatar(value);
        setHasSelection(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  function select(value: Avatar) {
    const current = ++version.current;
    setAvatar(value);
    setHasSelection(true);
    setMessage("");
    writes.current = writes.current.then(async () => {
      const saved = await saveAvatar(value);
      if (!saved && current === version.current)
        setMessage(
          "브라우저에 저장하지 못했습니다. 현재 선택은 이번 접속에서 사용할 수 있습니다.",
        );
    });
  }
  async function upload(file: File) {
    const current = ++version.current;
    setProcessing(true);
    setMessage("이미지를 변환하고 있습니다.");
    try {
      const value = await createAvatar(file);
      if (current !== version.current) return false;
      select(value);
      return true;
    } catch (error) {
      if (current === version.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "이미지를 처리하지 못했습니다.",
        );
      return false;
    } finally {
      setProcessing(false);
    }
  }
  return { avatar, hasSelection, processing, message, select, upload };
}
