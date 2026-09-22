import { useState, type ReactNode } from "react";
import {
  capacitySchema,
  disconnectGraceSchema,
  type Capacity,
} from "@yacht/shared";
type Props = {
  profilePicker?: ReactNode;
  nickname: string;
  code: string;
  onNicknameChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  connected: boolean;
  busy: boolean;
  onCreate: (
    nickname: string,
    capacity: Capacity,
    disconnectGraceSeconds?: number,
  ) => void;
  onJoin: (nickname: string, code: string) => void;
};
export function EntryScreen({
  connected,
  busy,
  onCreate,
  onJoin,
  nickname,
  code,
  onNicknameChange,
  onCodeChange,
  profilePicker,
}: Props) {
  const [capacity, setCapacity] = useState<Capacity>(2);
  const [grace, setGrace] = useState("");
  const validGrace =
    grace === "" || disconnectGraceSchema.safeParse(Number(grace)).success;
  return (
    <div className="entry-layout">
      <section className="entry panel" aria-labelledby="entry-title">
        <p className="eyebrow">2~4명이 함께하는 주사위 한 판</p>
        <h1 id="entry-title">
          오늘의 한 수를
          <br />
          굴려볼까요?
        </h1>
        <p className="muted">
          주사위 5개, 세 번의 기회.
          <br />방 코드를 나누고 함께 시작하세요.
        </p>
        {profilePicker}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (validGrace)
              onCreate(
                nickname,
                capacity,
                grace === "" ? undefined : Number(grace),
              );
          }}
        >
          <label htmlFor="nickname">닉네임</label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            maxLength={20}
            placeholder="어떻게 불러드릴까요?"
            autoComplete="nickname"
            required
          />
          <fieldset className="room-settings" disabled={busy}>
            <legend>새 방 설정</legend>
            <label htmlFor="room-capacity">최대 인원</label>
            <select
              id="room-capacity"
              value={capacity}
              onChange={(event) =>
                setCapacity(capacitySchema.parse(Number(event.target.value)))
              }
            >
              <option value={2}>2명</option>
              <option value={3}>3명</option>
              <option value={4}>4명</option>
            </select>
            <label htmlFor="room-grace">재접속 대기 시간 (초)</label>
            <input
              id="room-grace"
              type="number"
              min={1}
              max={86400}
              step={1}
              value={grace}
              placeholder="미입력 시 서버 기본값"
              aria-describedby="room-settings-hint"
              onChange={(event) => setGrace(event.target.value)}
              aria-invalid={!validGrace}
            />
            <p id="room-settings-hint" className="muted">
              연결이 끊긴 뒤 돌아올 수 있는 시간입니다. 1~86400초, 서버 기본
              설정은 60초입니다.
            </p>
            {!validGrace && (
              <p role="alert">1~86400 사이의 정수를 입력하세요.</p>
            )}
          </fieldset>
          <button
            className="primary wide"
            disabled={!connected || busy || !nickname.trim() || !validGrace}
          >
            새 방 만들기
          </button>
        </form>
        <div className="divider">초대받은 방이 있나요?</div>
        <form
          className="join"
          onSubmit={(e) => {
            e.preventDefault();
            onJoin(nickname, code);
          }}
        >
          <label className="sr-only" htmlFor="room-code">
            방 코드
          </label>
          <input
            id="room-code"
            value={code}
            onChange={(e) =>
              onCodeChange(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              )
            }
            placeholder="방 코드 8자리"
            maxLength={8}
            required
          />
          <button
            disabled={!connected || busy || !nickname.trim() || code.length < 6}
          >
            참가
          </button>
        </form>
      </section>
      <section
        className="entry-guide panel"
        aria-labelledby="entry-guide-title"
      >
        <p className="eyebrow">HOW TO PLAY</p>
        <h2 id="entry-guide-title">처음이라면, 이렇게 시작하세요</h2>
        <p className="muted">
          방에 모여 주사위를 굴리고, 점수표를 채우는 2~4인 게임입니다.
        </p>
        <ol className="entry-guide-steps">
          <li>
            <h3>프로필과 닉네임을 정하세요</h3>
            <p>
              프로필 프레임을 눌러 이미지를 고르고 닉네임을 입력하세요. 이미지를
              고르지 않아도 기본 프로필로 참가할 수 있어요.
            </p>
          </li>
          <li>
            <h3>방을 만들거나 초대받은 방에 참가하세요</h3>
            <p>
              새 방은 최대 인원과 재접속 대기 시간을 정해 만들어요. 초대받았다면
              방 코드를 입력하고 참가하세요. 초대 링크로 들어오면 코드가
              자동으로 입력돼요.
            </p>
          </li>
          <li>
            <h3>모두 준비하면 시작해요</h3>
            <p>
              2명 이상이 연결되어 모두 준비하면 정원이 차지 않아도 시작해요. 더
              기다리려면 준비를 누르지 마세요. 첫 차례는 무작위로 정해져요.
            </p>
          </li>
          <li>
            <h3>주사위를 굴리고 점수를 기록하세요</h3>
            <p>
              내 차례에 흔들기와 멈춤을 누르세요. 원하는 주사위는 눌러 보관하고
              나머지만 다시 굴릴 수 있어요. 점수 칸을 선택한 뒤 확정 버튼으로
              기록하면 다음 차례로 넘어가요.
            </p>
          </li>
          <li>
            <h3>점수표를 채우고 결과를 확인하세요</h3>
            <p>
              각자 12개 칸을 모두 채우면 최종 점수를 비교해요. 가장 높은 점수가
              승리하며, 같은 최고점은 공동 승리예요.
            </p>
          </li>
        </ol>
        <div className="entry-guide-rules" aria-labelledby="entry-rules-title">
          <h3 id="entry-rules-title">기억할 핵심 규칙</h3>
          <dl>
            <div>
              <dt>12번의 턴</dt>
              <dd>한 턴에 한 칸을 기록하고, 사용한 칸은 다시 쓸 수 없어요.</dd>
            </div>
            <div>
              <dt>최대 3번 굴림</dt>
              <dd>
                첫 굴림 이후에는 언제든 기록할 수 있어요. 조건이 맞지 않는
                칸에도 0점을 기록할 수 있어요.
              </dd>
            </div>
            <div>
              <dt>상단 보너스 +35점</dt>
              <dd>1~6 칸의 합계가 63점 이상이면 받아요.</dd>
            </div>
            <div>
              <dt>요트도 풀하우스</dt>
              <dd>주사위 5개의 눈이 모두 같으면 풀하우스로도 인정해요.</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
