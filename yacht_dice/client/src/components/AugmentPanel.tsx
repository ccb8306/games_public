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
  type AugmentCommand,
  type AugmentDefinition,
} from "@yacht/shared";

function Card({
  def,
  onClick,
  disabled,
  detail,
  ready,
}: {
  def: AugmentDefinition;
  onClick?: () => void;
  disabled?: boolean;
  detail?: string;
  ready?: boolean;
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
        <small>{detail ?? def.description}</small>
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
  const [burst, setBurst] = useState<string | null>(null),
    lastLog = useRef(a.log.at(-1));
  const latestResult = a.results?.at(-1);
  const [resultBurst, setResultBurst] =
    useState<typeof latestResult>(undefined);
  const lastResult = useRef(latestResult?.key);
  useEffect(() => {
    if (!latestResult || latestResult.key === lastResult.current) return;
    lastResult.current = latestResult.key;
    setResultBurst(latestResult);
    const timer = setTimeout(() => setResultBurst(undefined), 4200);
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
    const timer = setTimeout(() => setBurst(null), 1800);
    return () => clearTimeout(timer);
  }, [a.log.at(-1)]);
  const overlay = !!selected || library || a.drafting || !!t.chooseOld;
  useEffect(() => {
    if (!overlay) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".augment-overlay");
    dialog
      ?.querySelector<HTMLElement>("button:not(:disabled), select")
      ?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !a.drafting) {
        setSelected(null);
        setLibrary(false);
      }
      if (event.key !== "Tab" || !dialog) return;
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
      previous?.focus();
    };
  }, [overlay, selected, a.drafting, !!t.chooseOld]);
  if (!p || !ap) return null;
  const myTurn = room.currentPlayerId === playerId,
    usable = myTurn && !disabled && !a.drafting;
  const event = EVENTS.find((e) => e.id === a.event),
    def = AUGMENTS.find((d) => d.id === selected),
    eventDef = EVENTS.find((e) => e.id === selected);
  function open(id: string) {
    setSelected(id);
    setIndices([]);
  }
  function submit(fields: Partial<AugmentCommand> = {}) {
    onCommand({ op: "use", id: selected!, indices, ...fields });
    setSelected(null);
  }
  const dieAbilities = [
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
    if (before.includes(id))
      return room.rollCount === 0 && (id !== "revive" || ap!.previousZero);
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
      .map((k) => `${SCORE_LABELS[k]} ${augmentedScore(copy, p, k).total}`)
      .join(" · ");
  };
  return (
    <div className="augment-panel">
      {myTurn && t.pending && (
        <PendingAugmentChoice
          key={`${t.serial}:${t.pending}`}
          room={room}
          enabled={!disabled}
          onCommand={onCommand}
        />
      )}
      {resultBurst && (
        <div
          className="augment-result-burst"
          role="status"
          key={resultBurst.key}
        >
          <span aria-hidden="true">✦</span>
          <strong>{resultBurst.text}</strong>
        </div>
      )}
      {burst && !resultBurst && (
        <div className="augment-burst" role="status" key={burst}>
          {burst}
        </div>
      )}
      <div className="augment-status">
        <strong>✦ 증강 · {a.round}/12 라운드</strong>
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
      {a.drafting && !selected && (
        <div
          className="augment-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="증강 선택"
        >
          <div className="augment-dialog">
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <h2>{a.round}라운드 · 운명을 고르세요</h2>
            <p>3개 중 하나 · 선택한 증강은 모두에게 공개됩니다.</p>
            {ap.offers.length ? (
              <>
                <div className="augment-offers">
                  {ap.offers.map((id) => (
                    <Card
                      key={id}
                      def={AUGMENTS.find((d) => d.id === id)!}
                      disabled={disabled}
                      onClick={() => onCommand({ op: "pick", id })}
                    />
                  ))}
                </div>
                <button
                  disabled={disabled || ap.refreshed}
                  onClick={() => onCommand({ op: "refresh" })}
                >
                  선택지 새로고침 · {ap.refreshed ? "사용 완료" : "게임당 1회"}
                </button>
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
            <p>
              {room.players
                .filter((p) => p && !p.forfeited)
                .map(
                  (p) =>
                    `${p!.nickname}: ${p!.augment!.offers.length ? "선택 중" : "완료"}`,
                )
                .join(" / ")}
            </p>
          </div>
        </div>
      )}
      {a.duels.length > 0 && (
        <section
          className="augment-duels"
          aria-label="진행 중인 결투"
          aria-live="polite"
        >
          {a.duels.map((duel) => (
            <article key={`${duel.a}-${duel.b}-${duel.after}`}>
              <strong>⚔ 지옥의 합의 · 기본 점수 대결</strong>
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
                각자 다음 턴에 최대 2번 굴려요. 승자 +20점, 동점이면 각각 +10점.
              </small>
            </article>
          ))}
        </section>
      )}
      {!!a.results?.length && (
        <p className="augment-resolution" role="status">
          {a.results.at(-1)!.text}
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
              onClick={() => open(item.id)}
              detail={
                item.borrowedAt !== undefined
                  ? `대여 · ${item.remaining}회 남음 · 다음 내 턴 끝에 반납`
                  : goldDisabled(p, item.id)
                    ? "이번 턴 사용 중지 · 종료 후 복구"
                    : d.trigger === "passive"
                      ? "자동 발동 · 눌러 설명"
                      : item.remaining > 0
                        ? `${item.remaining}회 남음`
                        : item.remaining === 0
                          ? "사용 완료"
                          : item.usedTurn === t.serial
                            ? "이번 턴 사용 완료"
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
      {usable && t.chooseOld && (
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
        </div>
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
      {(selected || library) && (
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
                  번뜩임은 각 선택 단계에 10% 확률로 한 장 섞여요. 새로고침으로
                  당첨 여부를 다시 뽑지는 않아요.
                </p>
                <details>
                  <summary>헷갈리는 표현 한 번에 보기</summary>
                  <p>
                    ‘기본 족보 점수’는 족보를 완성해서 받는 원래 점수예요.
                    증강의 추가 점수나 2배 효과는 빼고 비교해요. ‘족보에 기록’은
                    실제 점수칸에 쓰는 점수, ‘보너스’는 아래 ‘증강 ±’에 따로
                    더하는 점수예요.
                  </p>
                  <p>
                    ‘무료 재굴림’은 남은 일반 굴림 횟수를 쓰지 않아요. ‘다음
                    턴’은 해당 사람이 다음에 주사위를 굴리는 차례예요.
                    ‘라운드’는 참가자 모두가 한 번씩 차례를 마칠 때까지예요.
                  </p>
                  <p>
                    상대 방해는 방패로 막을 수 있어요. 이미 다른 방해가 예약된
                    사람에게는 겹쳐 걸지 못해요. 모두에게 거는 능력도 그 사람은
                    제외해요. 점수를 빼앗을 때는 가진 점수와 턴당 피해 한도를
                    넘겨 가져올 수 없어요.
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
                  {AUGMENTS.filter(
                    (d) =>
                      catalogFilter === "all" ||
                      (catalogFilter === "flash" ? d.flash : !d.flash),
                  )
                    .sort(
                      (left, right) =>
                        ["silver", "gold", "prism"].indexOf(left.rarity) -
                          ["silver", "gold", "prism"].indexOf(right.rarity) ||
                        left.name.localeCompare(right.name, "ko"),
                    )
                    .map((d) => (
                      <Card key={d.id} def={d} />
                    ))}
                </div>
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
        </div>
      )}
    </div>
  );
}
