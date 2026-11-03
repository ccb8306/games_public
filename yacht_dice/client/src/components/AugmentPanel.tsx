import { createPortal } from "react-dom";
import { AugmentActivation } from "./AugmentActivation";
import {
  NEW_INPUTS,
  NewAugmentInputs,
  PendingAugmentChoice,
} from "./NewAugmentInputs";
import { AugmentIcon as Icon } from "./AugmentIcon";
import { FlashInputs } from "./FlashInputs";
import { AugmentActionInputs, DIRECT_INPUT_IDS } from "./AugmentActionInputs";
import { useEffect, useRef, useState } from "react";
import {
  AUGMENTS,
  MISCHIEF_IDS,
  EVENTS,
  SCORE_CATEGORIES,
  SCORE_LABELS,
  augmentedScore,
  pendingInstant,
  goldDisabled,
  type RoomState,
  type ScoreCategory,
  type AugmentCommand,
  type AugmentDefinition,
} from "@yacht/shared";

function Card({
  def,
  onClick,
  disabled,
  detail,
  ready,
  action,
}: {
  def: AugmentDefinition;
  onClick?: () => void;
  disabled?: boolean;
  detail?: string;
  ready?: boolean;
  action?: string;
}) {
  return (
    <button
      className={`augment-card ${def.rarity} ${def.flash ? "flash" : ""} ${ready ? "available" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={def.description}
    >
      <Icon id={def.id} />
      <span>
        <strong>
          {def.flash ? "✦ 번뜩임 · " : ""}
          {def.name}
        </strong>
        <small className="augment-rarity">
          {def.rarity === "silver"
            ? "실버"
            : def.rarity === "gold"
              ? "골드"
              : "프리즘"}
        </small>
        {def.flash && (
          <small className="augment-rarity">
            {{
              closed: "상대 점수표를 내 것으로!",
              strike: "점수판 전체 회전!",
              confiscate: "남의 주사위를 내 컵으로!",
              hostage: "몸값이냐, 주사위 3개 봉인이냐!",
              goldRush: "골드 셔플 + 내 카드 완충!",
              squid: "판돈과 보너스를 한 명이 독식!",
              handsUp: "남들만 전부 다시 섞어!",
              bombParcel: "안전한 납부냐, 역폭발 도박이냐!",
            }[def.id] ?? "상대의 다음 선택을 흔들어 보세요"}
          </small>
        )}
        <small>{detail ?? def.description}</small>
        {action && (
          <span className="augment-card-action">
            {action} <span aria-hidden="true">→</span>
          </span>
        )}
      </span>
    </button>
  );
}
export function AugmentPanel({
  room,
  playerId,
  disabled,
  onCommand,
  error,
}: {
  room: RoomState;
  playerId?: string;
  disabled: boolean;
  onCommand: (c: AugmentCommand) => void;
  error?: string;
}) {
  const a = room.augment!,
    p = room.players.find((p) => p?.id === playerId),
    ap = p?.augment,
    t = a.turn;
  const [selected, setSelected] = useState<string | null>(null),
    [indices, setIndices] = useState<number[]>([]),
    [library, setLibrary] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [catalogRarity, setCatalogRarity] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [burst, setBurst] = useState<string | null>(null),
    lastLog = useRef(a.log.at(-1));
  const latestResult = a.results?.at(-1);
  const [resultBurst, setResultBurst] =
    useState<typeof latestResult>(undefined);
  const lastResult = useRef(latestResult?.key);
  useEffect(() => {
    if (!latestResult || latestResult.key === lastResult.current) return;
    const previous = a.results.findIndex((r) => r.key === lastResult.current);
    const fresh = a.results.slice(previous + 1);
    lastResult.current = latestResult.key;
    setResultBurst({
      key: latestResult.key,
      text: fresh.map((r) => r.text).join("\n"),
      activation: latestResult.activation,
    });
    const timer = setTimeout(
      () => setResultBurst(undefined),
      latestResult.activation ? 6500 : 2000,
    );
    return () => clearTimeout(timer);
  }, [latestResult?.key]);
  useEffect(() => {
    const message = a.log.at(-1);
    if (message === lastLog.current) return;
    lastLog.current = message;
    if (
      !message?.includes("발동!") &&
      !message?.includes("방어!") &&
      !message?.includes("반사!")
    )
      return;
    setBurst(message);
  }, [a.log.at(-1)]);
  useEffect(() => {
    if (!burst) return;
    const timer = setTimeout(() => setBurst(null), 1800);
    return () => clearTimeout(timer);
  }, [burst]);
  const overlay =
    !!selected ||
    library ||
    a.drafting ||
    !!t.chooseOld ||
    (room.currentPlayerId === playerId && !!t.pending);
  useEffect(() => {
    if (!overlay) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>(".augment-overlay");
    dialog
      ?.querySelector<HTMLElement>("button:not(:disabled), select")
      ?.focus({ preventScroll: true });
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !a.drafting) {
        setSelected(null);
        setLibrary(false);
      }
      if (event.defaultPrevented || event.key !== "Tab" || !dialog) return;
      const nodes = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select, input",
        ),
      ];
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = oldOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, [overlay, selected, a.drafting, !!t.chooseOld, t.pending]);
  if (!p || !ap) return null;
  const myTurn = room.currentPlayerId === playerId,
    usable = myTurn && !disabled && !a.drafting;
  const event = EVENTS.find((e) => e.id === a.event),
    def = AUGMENTS.find((d) => d.id === selected),
    eventDef = EVENTS.find((e) => e.id === selected);
  const catalogCards = AUGMENTS.filter(
    (d) =>
      !d.retired &&
      (catalogFilter === "all" ||
        (catalogFilter === "flash" ? d.flash : !d.flash)) &&
      (catalogRarity === "all" || d.rarity === catalogRarity) &&
      `${d.name} ${d.description}`.includes(catalogSearch.trim()),
  ).sort(
    (a, b) =>
      ["silver", "gold", "prism"].indexOf(a.rarity) -
        ["silver", "gold", "prism"].indexOf(b.rarity) ||
      a.name.localeCompare(b.name, "ko"),
  );
  function open(id: string) {
    setSelected(id);
    setIndices([]);
  }
  function submit(fields: Partial<AugmentCommand> = {}) {
    onCommand({ op: "use", id: selected!, indices, ...fields });
    setSelected(null);
  }
  const dieAbilities = [
    "collector",
    "artisan",
    "fakeHouse",
    "nudge",
    "evolution",
    "mirror",
    "flip",
    "clone",
    "alchemy",
    "wild",
    "reverse",
    "even",
    "choiceRoll",
    "chaos",
    "exchange",
    "revive",
  ];
  const before = [
    "parasite",
    "scoreRemodel",
    "memory",
    "target",
    "loan",
    "devil",
    "revive",
    "bomb",
    "debt",
  ];
  function available(id: string) {
    if (!usable && !(a.drafting && !disabled && pendingInstant(p!) === id))
      return false;
    const d = AUGMENTS.find((d) => d.id === id),
      items = ap!.items.filter((i) => i.id === id);
    if (!d && !["reverse", "bomb", "chaos", "debt", "exchange"].includes(id))
      return false;
    if (
      d &&
      (d.trigger !== "active" ||
        !items.some((i) => i.remaining !== 0 && i.usedTurn !== t.serial))
    )
      return false;
    if (!d && t.flags.includes(id)) return false;
    if (goldDisabled(p!, id)) return false;
    if (d?.flash || MISCHIEF_IDS.includes(id))
      return usable && room.rollPhase === "idle";
    if (before.includes(id)) return room.rollCount === 0;
    if (["swap", "doppel", "thief", "lock", "seal", "duel"].includes(id))
      return true;
    if (id === "fork")
      return (
        room.rollPhase === "idle" &&
        !t.fork &&
        !t.pending &&
        !(
          room.rollCount === 0 &&
          ap!.curse?.active &&
          ["dropIt", "receipt", "practice", "hostage", "lock"].includes(
            ap!.curse.id,
          )
        ) &&
        room.rollCount < t.maxRolls &&
        !t.flags.includes("final")
      );
    if (!room.rollCount || t.chooseOld) return false;
    if (id === "cat")
      return (
        t.maxRolls > 1 &&
        room.rollCount >= t.maxRolls &&
        !t.oldWorld &&
        !t.flags.includes("final")
      );
    if (id === "exchange" && room.rollCount < 2) return false;
    if (id === "lastmove" && (room.rollCount < 3 || t.flags.includes("final")))
      return false;
    if (
      t.flags.includes("wild") &&
      dieAbilities.concat("worldFlip").includes(id)
    )
      return false;
    return true;
  }
  const preview = (world: "old" | "new") => {
    const copy = structuredClone(room);
    if (world === "old" && t.oldWorld) copy.dice = t.oldWorld.dice;
    return SCORE_CATEGORIES.filter((k) => p.scores[k] === null)
      .map(
        (k) => `${SCORE_LABELS[k]} 기록 ${augmentedScore(copy, p, k).score}점`,
      )
      .join(" · ");
  };
  return (
    <div className="augment-panel">
      {myTurn &&
        t.pending &&
        createPortal(
          <PendingAugmentChoice
            key={`${t.serial}:${t.pending}`}
            room={room}
            enabled={!disabled}
            onCommand={onCommand}
          />,
          document.body,
        )}
      {resultBurst &&
        createPortal(
          <div
            className={`augment-result-burst ${resultBurst.activation ? "activation-burst" : ""}`}
            data-kind={resultBurst.activation?.kind}
            data-rarity={resultBurst.activation?.rarity}
            data-flash={resultBurst.activation?.flash}
            role="status"
            key={resultBurst.key}
          >
            {resultBurst.activation ? (
              <AugmentActivation activation={resultBurst.activation} />
            ) : (
              <>
                <span aria-hidden="true">✦</span>
                <strong>{resultBurst.text}</strong>
              </>
            )}
            <button
              type="button"
              aria-label="지급 알림 닫기"
              onClick={() => setResultBurst(undefined)}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
      {burst &&
        !resultBurst &&
        createPortal(
          <div className="augment-burst" role="status" key={burst}>
            {burst}
          </div>,
          document.body,
        )}
      <div className="augment-status">
        {ap?.rollBank !== undefined && !myTurn && (
          <span>몰빵 잔고 {ap.rollBank}회 · 다음 내 턴에 사용</span>
        )}
        {ap?.rollBank !== undefined && myTurn && (
          <span>
            몰빵 잔고 {Math.max(0, ap.rollBank - room.rollCount)}회 · 이번 턴{" "}
            {Math.max(0, t.maxRolls - room.rollCount)}회 가능 · 이후 턴{" "}
            {Math.max(
              0,
              11 - Object.values(p.scores).filter((n) => n !== null).length,
            )}
            회 예약
            {Math.max(
              0,
              ap.rollBank -
                room.rollCount -
                (Math.max(0, t.maxRolls - room.rollCount) +
                  Math.max(
                    0,
                    11 -
                      Object.values(p.scores).filter((n) => n !== null).length,
                  ) *
                    7),
            ) > 0 && <b> · 이대로면 일부 잔고가 남아 소멸해요</b>}
          </span>
        )}
        <strong>✦ 증강 · {a.round}/12 라운드</strong>
        {ap?.bounties?.map((b) => (
          <span key={b.from} className="augment-curse">
            {room.players.find((q) => q?.id === b.from)?.nickname}의 수배: 내
            다음 결과에 {b.face}가 2개 이상이면 상대 +8점, 피하면 나 +3점
          </span>
        ))}
        <button onClick={() => setLibrary(true)}>능력 도감</button>
        {usable && t.oldWorld && (
          <button onClick={() => open("world")}>두 세계 비교</button>
        )}
        {event && (
          <button title={event.description} onClick={() => open(event.id)}>
            사건 · {event.name}
          </button>
        )}
      </div>
      {a.drafting &&
        !selected &&
        createPortal(
          <div
            className="augment-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="증강 선택"
          >
            <div className="augment-dialog augment-draft">
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <div className="augment-draft-heading">
                <span className="augment-eyebrow">
                  ROUND {a.round} ·{" "}
                  {a.round === 1 ? "실버" : a.round === 10 ? "프리즘" : "골드"}{" "}
                  증강
                </span>
                <h2>어떤 능력으로 판을 흔들까요?</h2>
                <p>
                  하나를 골라 획득하세요. 마음에 안 드는 카드는{" "}
                  <b>각각 한 번씩</b> 리롤할 수 있어요.
                </p>
              </div>
              {ap.offers.length ? (
                <>
                  <div className="augment-offers">
                    {ap.offers.map((id, offerIndex) => (
                      <div className="augment-offer-slot" key={offerIndex}>
                        <Card
                          key={id}
                          def={AUGMENTS.find((d) => d.id === id)!}
                          detail={`${AUGMENTS.find((d) => d.id === id)!.description} · 남은 ${12 - Object.values(p.scores).filter((n) => n !== null).length}턴${id === "hunter" ? ` · 포커/요트 ${["fourOfAKind", "yacht"].filter((k) => p.scores[k as ScoreCategory] === null).length}칸` : id === "defect" ? ` · 적용 가능한 하단 ${SCORE_CATEGORIES.slice(7).filter((k) => p.scores[k] === null).length}칸` : ""}`}
                          disabled={disabled}
                          action="이 증강 선택"
                          onClick={() => onCommand({ op: "pick", id })}
                        />
                        <button
                          className="augment-reroll"
                          data-spent={ap.rerolled[offerIndex]}
                          disabled={disabled || ap.rerolled[offerIndex]}
                          aria-label={`${offerIndex + 1}번 증강 ${AUGMENTS.find((d) => d.id === id)!.name} ${ap.rerolled[offerIndex] ? "리롤 완료" : "리롤"}`}
                          title="이 카드만 같은 등급의 다른 증강으로 교체합니다. 다른 두 카드는 유지돼요."
                          onClick={() =>
                            onCommand({ op: "refresh", offerIndex, id })
                          }
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20 7v5h-5M4 17v-5h5M5.3 8a7.5 7.5 0 0 1 12.4-2L20 9M4 15l2.3 3A7.5 7.5 0 0 0 18.7 16" />
                          </svg>
                          <span>
                            {ap.rerolled[offerIndex]
                              ? "리롤 완료"
                              : "이 카드 리롤"}
                            <small>
                              {ap.rerolled[offerIndex]
                                ? "이 자리의 리롤을 사용했어요"
                                : "1회 남음 · 다른 카드는 그대로"}
                            </small>
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="augment-reroll-summary" role="status">
                    ↻ 리롤 가능한 카드 {ap.rerolled.filter((v) => !v).length}/3
                    · 다음 증강 선택 때 다시 충전돼요.
                  </p>
                  {a.round === 7 && ap.items.some((i) => i.id === "nudge") && (
                    <Card
                      def={AUGMENTS.find((d) => d.id === "evolution")!}
                      disabled={disabled}
                      detail="골드 선택 대신 손끝 보정을 희생해 진화"
                      onClick={() => onCommand({ op: "pick", id: "evolution" })}
                    />
                  )}
                </>
              ) : (
                <div>
                  {pendingInstant(p) ? (
                    <button
                      className="primary"
                      onClick={() => open(pendingInstant(p)!)}
                    >
                      {AUGMENTS.find((d) => d.id === pendingInstant(p))?.name}
                    </button>
                  ) : (
                    <p>
                      {
                        "\uC120\uD0DD \uC644\uB8CC \u00B7 \uB2E4\uB978 \uD50C\uB808\uC774\uC5B4\uB97C \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694."
                      }
                    </p>
                  )}
                </div>
              )}
              <div
                className="augment-draft-players"
                aria-label="플레이어 선택 현황"
              >
                {room.players
                  .filter((p) => p && !p.forfeited)
                  .map((q) => (
                    <span
                      key={q!.id}
                      data-ready={
                        !q!.augment!.offers.length && !pendingInstant(q!)
                      }
                    >
                      {q!.nickname}
                      <b>
                        {q!.augment!.offers.length
                          ? "선택 중"
                          : pendingInstant(q!)
                            ? "대상 선택 중"
                            : "✓ 선택 완료"}
                      </b>
                    </span>
                  ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
      {a.duels.length > 0 && (
        <section
          className="augment-duels"
          aria-label="진행 중인 결투"
          aria-live="polite"
        >
          {a.duels.map((duel) => (
            <article key={`${duel.a}-${duel.b}-${duel.after}`}>
              <strong>⚔ 콜? 쫄? · 기본 점수 대결</strong>
              {[
                { id: duel.a, score: duel.aScore },
                { id: duel.b, score: duel.bScore },
              ].map(({ id, score }) => (
                <p key={id}>
                  {room.players.find((q) => q?.id === id)?.nickname ??
                    "나간 플레이어"}
                  {" · "}
                  {score !== null
                    ? `${score}점 확정`
                    : room.currentPlayerId === id && t.serial > duel.after
                      ? `결투 중 · 일반 굴림 ${room.rollCount}/${t.maxRolls}회`
                      : "다음 턴 대기"}
                </p>
              ))}
              <small>
                {duel.accepted
                  ? "승부 성립! 각자 최대 2번 · 승자 +35 / 패자 -10 / 동점 각각 +10점"
                  : "상대 응답 대기 · 거절하면 내게 10점과 다음 턴 굴림 +1회"}
              </small>
            </article>
          ))}
        </section>
      )}
      {a.jackpot && (
        <section
          className="augment-stakes"
          aria-label="공동 판돈 현황"
          aria-live="polite"
        >
          <small>판돈은 목숨입니다 · 20점씩 납부 완료</small>
          <strong>우승 지급액 {a.jackpot.pot + 60}점</strong>
          {a.jackpot.entries.map((e) => (
            <p key={e.id}>
              {room.players.find((q) => q?.id === e.id)?.nickname}{" "}
              <b>
                {e.score === null ? "다음 턴 승부 대기" : `${e.score}점 확정`}
              </b>
            </p>
          ))}
          <small>
            시전자 최대 3회 · 상대 최대 2회 · 기본 족보 최고점 우승 · 동점 분할
          </small>
        </section>
      )}
      {myTurn && t.flags.includes("loan") && (
        <section className="augment-stakes" aria-label="도박 판돈">
          <small>여기서 두 배를 태워? · 기본 족보 25점 이상 도전</small>
          <strong>
            {t.flags.includes("loanDouble") ||
            t.flags.includes("loanDoublePending")
              ? "성공 +40 / 실패 -20"
              : "성공 +20 / 실패 -10"}
          </strong>
          {t.flags.includes("loanDoublePending") && (
            <small>두 배 승부 예약 · 던지기를 완료해야 기록할 수 있어요.</small>
          )}
          {!t.flags.includes("loanDouble") &&
            !t.flags.includes("loanDoublePending") && (
              <button
                disabled={
                  !usable ||
                  room.rollCount !== 2 ||
                  room.rollCount >= t.maxRolls ||
                  room.held.every(Boolean) ||
                  t.flags.includes("final") ||
                  !!t.pending ||
                  !!t.reroll ||
                  !!t.oldWorld ||
                  !!t.chooseOld ||
                  goldDisabled(p, "loan")
                }
                onClick={() => onCommand({ op: "use", id: "loanDouble" })}
              >
                두 배 걸고 한 번 더!
              </button>
            )}
        </section>
      )}
      {!!a.results?.length && (
        <details className="augment-receipts">
          <summary>
            ✦ 지급·발동 내역{" "}
            <strong>
              증강 보너스 누적 {ap.bonus >= 0 ? "+" : ""}
              {ap.bonus}점
            </strong>
          </summary>
          <p>
            누적 보너스는 족보 점수와 별도로 총점에 반영됩니다. 예약은 지급 전
            상태예요.
          </p>
          <ol>
            {[...a.results].reverse().map((result) => (
              <li key={result.key}>{result.text}</li>
            ))}
          </ol>
        </details>
      )}
      {myTurn && (t.erase || t.parallel) && (
        <p className="augment-use-hint" role="status">
          ⏳ 점수 확정 시 적용 · 아직 지급 전<br />
          {t.erase === "bonus"
            ? "지워진 0: 대체 보너스 +20점 예약"
            : t.erase
              ? "지워진 0: 기존 0점 칸 재채점 예약"
              : ""}
          {t.parallel
            ? `${t.erase ? " · " : ""}한 턴에 두 탕: ${SCORE_LABELS[t.parallel as ScoreCategory]} 전액 보너스 예약 · 최대 40점`
            : ""}
        </p>
      )}
      <div className="augment-hand">
        {ap.items.map((item, i) => {
          const d = AUGMENTS.find((d) => d.id === item.id)!;
          return (
            <Card
              key={`${item.id}-${i}`}
              def={d}
              ready={available(item.id)}
              action={
                d.trigger === "passive"
                  ? "자동 적용 · 설명"
                  : available(item.id)
                    ? "사용하기"
                    : "설명 보기"
              }
              onClick={() => open(item.id)}
              detail={
                item.id === "revive"
                  ? `보유 ${item.remaining}회 · 이 카드 ${item.uses ?? 0}/3회 사용`
                  : item.id === "savings"
                    ? `현재 ${Math.min(3, ap.streak)}/3연속 · ${ap.progress?.savings ?? 0}/3회 지급`
                    : item.id === "loser"
                      ? `이 카드 ${item.uses ?? 0}/3턴 발동`
                      : item.id === "parasite" && item.target
                        ? `${room.players.find((q) => q?.id === item.target)?.nickname ?? "나간 플레이어"}와 계약 · 누적 +${item.earned ?? 0}/36점`
                        : item.id === "stubborn"
                          ? myTurn
                            ? `보관 유지 ${t.kept.length}개 · 금고 ${t.kept.length >= 2 ? Math.min(9, Math.max(0, room.rollCount - 1) * 3) : 0}점`
                            : "다음 내 턴에 금고를 채워요"
                          : item.id === "clockwork"
                            ? `${myTurn ? `이번 올인 ${t.flags.filter((f) => f.startsWith("allInRoll:")).length}회 · ` : ""}누적 +${ap.progress?.clockwork ?? 0}/36점`
                            : item.borrowedAt !== undefined
                              ? `대여 · ${item.remaining}회 남음 · 다음 내 턴 끝에 반납`
                              : goldDisabled(p, item.id)
                                ? "이번 턴 사용 중지 · 종료 후 복구"
                                : d.trigger === "passive"
                                  ? ["savings", "loser"].includes(item.id)
                                    ? `${ap.progress?.[item.id] ?? 0}/3회 발동 · 자동 적용`
                                    : ["spectator", "parasite"].includes(
                                          item.id,
                                        )
                                      ? `누적 +${ap.progress?.[item.id] ?? 0}/${item.id === "spectator" ? 24 : 40}점`
                                      : "자동 발동 · 눌러 설명"
                                  : item.remaining === 0
                                    ? ["artisan", "fakeHouse"].includes(item.id)
                                      ? "조작 완료 · 자동 효과 유지"
                                      : "모두 사용했어요"
                                    : item.usedTurn === t.serial
                                      ? `이번 턴 사용 완료${item.remaining > 0 ? ` · ${item.remaining}회 남음` : ""}`
                                      : item.remaining > 0
                                        ? `${item.remaining}회 남음`
                                        : "턴당 1회"
              }
            />
          );
        })}
      </div>
      {room.players
        .filter((q) => q?.augment?.curse)
        .map((q) => {
          const curse = q!.augment!.curse!;
          return (
            <p className="augment-warning" key={q!.id}>
              ⚠ {q!.nickname} · {AUGMENTS.find((d) => d.id === curse.id)?.name}{" "}
              ·{" "}
              {curse.active
                ? "적용 중 · 이번 턴 끝에 해제"
                : "예약됨 · 다음 개인 턴"}
              {curse.categories
                ? ` · 기록 가능: ${SCORE_CATEGORIES.filter(
                    (k) =>
                      q!.scores[k] === null && !curse.categories!.includes(k),
                  )
                    .map((k) => SCORE_LABELS[k])
                    .join(", ")}`
                : ""}
              {curse.other
                ? curse.id === "bounty"
                  ? ` · 수배 숫자 ${curse.other}`
                  : curse.id === "confiscate"
                    ? ` · 다음 턴 +${curse.other}개`
                    : ` · ${AUGMENTS.find((d) => d.id === curse.other)?.name ?? curse.other}`
                : ""}
            </p>
          );
        })}
      {t.locked !== null && (
        <p className="augment-warning">🔒 {t.locked + 1}번 주사위 강제 보관</p>
      )}
      {usable &&
        t.chooseOld &&
        createPortal(
          <div
            className="augment-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="재굴림 결과 선택"
          >
            <div className="augment-dialog augment-choice">
              <strong>최후의 선택 · {t.chooseOld.index + 1}번</strong>
              <button onClick={() => onCommand({ op: "keepOld", value: 1 })}>
                이전 눈 {t.chooseOld.old}
              </button>
              <button onClick={() => onCommand({ op: "keepOld", value: 0 })}>
                새 눈 {room.dice[t.chooseOld.index]}
              </button>
            </div>
          </div>,
          document.body,
        )}
      {room.dice.length > 5 && (
        <p>추가 주사위 포함 · {room.dice.length}개 전체로 채점합니다.</p>
      )}
      <details className="augment-history">
        <summary>효과 기록 · {a.log.at(-1)}</summary>
        {a.log
          .slice()
          .reverse()
          .map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        {room.players
          .filter((q) => q && q.id !== p.id)
          .map((q) => (
            <p key={q!.id}>
              <b>{q!.nickname}</b>:{" "}
              {q!.augment?.items
                .map((i) => AUGMENTS.find((d) => d.id === i.id)?.name)
                .join(" / ")}
            </p>
          ))}
      </details>
      {(selected || library) &&
        createPortal(
          <div
            className="augment-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={library ? "증강 도감" : "능력 사용"}
          >
            <div className="augment-dialog">
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="augment-close"
                onClick={() => {
                  setSelected(null);
                  setLibrary(false);
                }}
              >
                닫기 ✕
              </button>
              {library ? (
                <>
                  <h2>운명의 주사위 · 증강 도감</h2>
                  <p>실버 → 골드 → 골드 → 프리즘 · 1·4·7·10라운드 선택</p>
                  <p>
                    번뜩임은 각 선택 단계에 10% 확률로 한 장 섞여요.
                    새로고침으로 당첨 여부를 다시 뽑지는 않아요.
                  </p>
                  <div className="augment-catalog-tools">
                    <label>
                      능력 찾기
                      <input
                        type="search"
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        placeholder="이름이나 효과 검색 · 예: 주사위, 방패"
                      />
                    </label>
                    <label>
                      등급
                      <select
                        value={catalogRarity}
                        onChange={(e) => setCatalogRarity(e.target.value)}
                      >
                        <option value="all">모든 등급</option>
                        <option value="silver">실버</option>
                        <option value="gold">골드</option>
                        <option value="prism">프리즘</option>
                      </select>
                    </label>
                  </div>
                  <details>
                    <summary>헷갈리는 표현 한 번에 보기</summary>
                    <p>
                      ‘기본 족보 점수’는 족보를 완성해서 받는 원래 점수예요.
                      증강의 추가 점수나 2배 효과는 빼고 비교해요. ‘족보에
                      기록’은 실제 점수칸에 쓰는 점수, ‘보너스’는 아래 ‘증강
                      ±’에 따로 더하는 점수예요.
                    </p>
                    <p>
                      ‘무료 재굴림’은 남은 일반 굴림 횟수를 쓰지 않아요. ‘다음
                      턴’은 해당 사람이 다음에 주사위를 굴리는 차례예요.
                      ‘라운드’는 참가자 모두가 한 번씩 차례를 마칠 때까지예요.
                    </p>
                    <p>
                      상대 방해는 방패로 막을 수 있어요. 이미 다른 방해가 예약된
                      사람에게는 겹쳐 걸지 못해요. 모두에게 거는 능력도 그
                      사람은 제외해요. 점수를 빼앗을 때는 가진 점수와 턴당 피해
                      한도를 넘겨 가져올 수 없어요.
                    </p>
                  </details>
                  <div className="augment-choice">
                    {[
                      ["all", "전체"],
                      ["normal", "일반"],
                      ["flash", "번뜩임"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={catalogFilter === value}
                        onClick={() => setCatalogFilter(value!)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="augment-catalog">
                    {catalogCards.map((d) => (
                      <Card key={d.id} def={d} />
                    ))}
                  </div>
                  <p className="augment-search-status" role="status">
                    {catalogCards.length
                      ? `${catalogCards.length}개 증강 · 등급 → 이름 순`
                      : "일치하는 증강이 없어요. 검색어나 등급을 바꿔보세요."}
                  </p>
                  <h3
                    className="augment-catalog-heading"
                    id="catalog-events-title"
                  >
                    난장판 사건 · 8종
                  </h3>
                  <p>3·6·9·12라운드에 모두에게 적용됩니다.</p>
                  <div
                    className="augment-catalog augment-event-catalog"
                    aria-labelledby="catalog-events-title"
                  >
                    {EVENTS.map((e) => (
                      <article className="augment-card event" key={e.id}>
                        <span className="augment-event-icon" aria-hidden="true">
                          ✦
                        </span>
                        <span>
                          <strong>{e.name}</strong>
                          <small>{e.description}</small>
                        </span>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2>
                    {def?.name ??
                      eventDef?.name ??
                      (selected === "world"
                        ? "상자 속 고양이 · 세계 비교"
                        : "능력 사용")}
                  </h2>
                  <p>
                    {def?.description ??
                      eventDef?.description ??
                      (selected === "world"
                        ? "하나의 세계를 확정하면 더 이상 일반 굴림을 할 수 없습니다."
                        : "")}
                  </p>
                  {def?.trigger === "active" && !available(def.id) && (
                    <p className="augment-use-hint" role="status">
                      {disabled
                        ? "연결 상태나 진행 중인 동작을 확인해 주세요."
                        : a.drafting
                          ? "모두 증강을 고른 뒤 사용할 수 있어요."
                          : !myTurn
                            ? "내 차례에 사용할 수 있어요."
                            : ap.items
                                  .filter((i) => i.id === def.id)
                                  .every((i) => i.remaining === 0)
                              ? "남은 사용 횟수가 없어요."
                              : ap.items
                                    .filter((i) => i.id === def.id)
                                    .every((i) => i.usedTurn === t.serial)
                                ? "이번 턴에는 이미 사용했어요."
                                : goldDisabled(p, def.id)
                                  ? "상대의 방해로 이번 턴은 사용할 수 없어요."
                                  : before.includes(def.id) &&
                                      room.rollCount > 0
                                    ? "첫 굴림 전에 사용하는 능력이에요. 다음 턴에 사용하세요."
                                    : !room.rollCount
                                      ? "먼저 주사위를 굴려주세요."
                                      : "사용 조건을 확인하세요. 진행 중인 결과 선택을 먼저 마쳐야 해요."}
                    </p>
                  )}
                  {!NEW_INPUTS.includes(selected ?? "") &&
                    (def?.flash || MISCHIEF_IDS.includes(selected ?? "")) && (
                      <FlashInputs
                        key={selected}
                        room={room}
                        player={p}
                        id={selected!}
                        enabled={available(selected!)}
                        onUse={submit}
                      />
                    )}
                  {NEW_INPUTS.includes(selected!) && (
                    <NewAugmentInputs
                      key={selected}
                      room={room}
                      player={p}
                      id={selected!}
                      enabled={available(selected!)}
                      onUse={submit}
                    />
                  )}
                  {!NEW_INPUTS.includes(selected!) &&
                    DIRECT_INPUT_IDS.includes(selected!) && (
                      <AugmentActionInputs
                        key={selected}
                        id={selected!}
                        room={room}
                        player={p}
                        enabled={available(selected!)}
                        onUse={submit}
                      />
                    )}
                  {selected === "worldFlip" && (
                    <div className="augment-choice">
                      {room.dice.map((n, i) => (
                        <button
                          key={i}
                          aria-pressed={indices.includes(i)}
                          onClick={() =>
                            setIndices(
                              indices.includes(i)
                                ? indices.filter((j) => j !== i)
                                : [...indices, i],
                            )
                          }
                        >
                          {i + 1}번 · {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {NEW_INPUTS.includes(selected ?? "") ||
                  def?.flash ||
                  MISCHIEF_IDS.includes(selected ?? "") ||
                  DIRECT_INPUT_IDS.includes(selected!) ||
                  selected === "world" ? null : (
                    <button
                      className="primary"
                      disabled={
                        !available(selected!) ||
                        (selected === "worldFlip" && !indices.length)
                      }
                      onClick={() => submit()}
                    >
                      {available(selected!)
                        ? "능력 사용"
                        : "지금은 사용할 수 없어요"}
                    </button>
                  )}
                  {selected === "world" && t.oldWorld && (
                    <div className="augment-worlds">
                      <button
                        onClick={() => {
                          onCommand({ op: "world", value: 1 });
                          setSelected(null);
                        }}
                      >
                        원래 세계 {t.oldWorld.dice.join(" · ")}
                        <small>{preview("old")}</small>
                      </button>
                      <button
                        onClick={() => {
                          onCommand({ op: "world", value: 0 });
                          setSelected(null);
                        }}
                      >
                        새 세계 {room.dice.join(" · ")}
                        <small>{preview("new")}</small>
                      </button>
                    </div>
                  )}
                  {before.includes(selected!) && (
                    <p>첫 굴림 전에 사용해야 합니다.</p>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
