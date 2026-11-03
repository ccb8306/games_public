import { z } from "zod";

export type AugmentDefinition = {
  id: string;
  name: string;
  rarity: "silver" | "gold" | "prism";
  description: string;
  trigger: "passive" | "active";
  charges: number;
  tags: string[];
  flash?: boolean;
};
const rows: [string, string, string, number, string][] = [
  [
    "nudge",
    "손끝 보정",
    "굴린 주사위 하나를 1 올리거나 내려요. 예: 4 → 3 또는 5. 1~6 안에서, 턴당 1회·게임당 3회.",
    3,
    "change",
  ],
  [
    "mirror",
    "거울 조각",
    "굴린 주사위 하나를 뒤집어요. 1↔6, 2↔5, 3↔4로 바뀌어요. 게임당 3회.",
    3,
    "change",
  ],
  [
    "cleaner",
    "바닥 청소부",
    "점수를 기록할 때 주사위에 1이 2개 이상 있으면 보너스 +6점.",
    0,
    "ones",
  ],
  [
    "collector",
    "중복은 못 참지",
    "같은 눈이 둘 이상이면 그중 하나를 무료로 다시 던져요. 새 결과는 반드시 사용! 일반 굴림 횟수는 그대로. 턴당 1회·게임당 2회.",
    2,
    "straight",
  ],
  [
    "rest",
    "얌체 휴식",
    "한 번만 굴리고 기록하면 +6점, 두 번 굴렸으면 +3점. 세 번 이상 굴리면 보너스가 없어요. 무료 재굴림은 세지 않아요.",
    0,
    "early",
  ],
  [
    "stubborn",
    "고집불통",
    "첫 굴림에서 주사위 2개 이상을 보관하고, 그 주사위를 끝까지 다시 굴리지 않으면 보너스 +3점.",
    0,
    "hold",
  ],
  [
    "odd",
    "홀수 왕국",
    "점수를 기록할 때 홀수(1·3·5) 주사위가 4개 이상이면 보너스 +6점.",
    0,
    "odd",
  ],
  [
    "even",
    "불량품 반품",
    "1이 나온 주사위 하나를 다시 굴려요. 일반 굴림 횟수는 줄지 않지만 새 결과를 써야 해요. 턴당 1회·게임당 2회.",
    2,
    "roll",
  ],
  [
    "clockwork",
    "노 브레이크",
    "첫 굴림 뒤 아무것도 보관하지 않고 전부 다시 굴려 보세요. 그 턴에 0점이 아닌 족보를 기록하면 보너스 +4점. 턴당 한 번만 받아요.",
    0,
    "gamble",
  ],
  [
    "upper",
    "상단 후원자",
    "상단 숫자 칸에 같은 숫자 3개 이상을 기록하면 보너스 +5점. 예: 5가 3개일 때 파이브 칸에 기록.",
    0,
    "upper",
  ],
  [
    "lower",
    "꽝 적립소",
    "지난 내 턴에 족보를 0점으로 기록했다면, 이번에는 1점 이상 기록할 때 보너스 +8점.",
    0,
    "zero",
  ],
  [
    "savings",
    "적금 만기",
    "내 턴 3번 연속으로 족보에 1점 이상 기록하면 보너스 +12점. 게임 중 딱 한 번 받아요.",
    0,
    "safe",
  ],
  [
    "lifebuoy",
    "구명튜브",
    "족보에 0점을 기록하면, 다음 내 턴의 일반 굴림이 1회 늘어나요.",
    0,
    "zero",
  ],
  [
    "lastmove",
    "마지막 한 수",
    "세 번째 일반 굴림까지 한 뒤 족보에 1점 이상 기록하면 보너스 +3점. 무료 재굴림은 횟수에 넣지 않아요.",
    0,
    "roll",
  ],
  [
    "six",
    "6의 신봉자",
    "점수를 기록할 때 6이 나온 주사위가 3개 이상이면 보너스 +7점.",
    0,
    "six",
  ],
  [
    "spectator",
    "남의 떡 구경",
    "상대가 기본 족보 점수 30점 이상을 기록하면 나는 +3점. 한 라운드에 최대 +6점까지 받아요.",
    0,
    "rival",
  ],
  [
    "shield",
    "소형 방패",
    "나에게 처음 들어오는 방해를 자동으로 한 번 막아요. 막고 나면 사라져요.",
    1,
    "defense",
  ],
  [
    "underdog",
    "언더독",
    "내 턴 시작에 1위보다 25점 이상 뒤처졌다면, 그 턴에 족보 1점 이상 기록 시 보너스 +6점.",
    0,
    "comeback",
  ],
  [
    "fourth",
    "네 번째 기회",
    "매 턴 일반 굴림이 1회 늘어나요. 기본 3회라면 4회까지 굴릴 수 있어요.",
    0,
    "roll",
  ],
  [
    "clone",
    "복제술",
    "내 주사위 하나의 눈을 다른 주사위에 복사해요. 예: 6·2 → 6·6. 턴당 1회·게임당 4회.",
    4,
    "change",
  ],
  [
    "alchemy",
    "주사위 연금술",
    "굴린 주사위 하나를 원하는 숫자(1~6)로 바꿔요. 게임당 2회. 한 턴에 두 번 써도 돼요.",
    2,
    "change",
  ],
  [
    "flip",
    "양면 주사위",
    "굴린 주사위 하나를 뒤집어요. 1↔6, 2↔5, 3↔4로 바뀌어요. 매 턴 1회.",
    -1,
    "change",
  ],
  [
    "choiceRoll",
    "최후의 선택",
    "주사위 하나를 다시 굴린 뒤, 이전 눈과 새 눈 중 좋은 쪽을 골라요. 일반 굴림 횟수는 줄지 않아요. 매 턴 1회.",
    -1,
    "roll",
  ],
  [
    "fakeHouse",
    "강제 룸메이트",
    "주사위 둘의 눈을 합은 그대로, 최대한 같게 나눠요. 1·5→3·3, 2·5→3·4! 턴당 1회·게임당 3회. 덤으로 4+1도 풀하우스 25점 인정.",
    3,
    "kind",
  ],
  [
    "artisan",
    "스트레이트 밀수업자",
    "중복된 주사위 하나를 지금 없는 숫자로 바꿔요. 1·2·2·4·5에서 2→3! 턴당 1회·게임당 3회. 서로 다른 눈 5종 이상으로 기록하면 어느 칸이든 +5점.",
    3,
    "straight",
  ],
  [
    "hunter",
    "사냥꾼",
    "포커(같은 눈 4개)나 요트를 완성해 해당 칸에 기록하면, 그 족보 점수에 +15점.",
    0,
    "kind",
  ],
  [
    "chance",
    "이번 판은 현금으로",
    "족보를 포기하고 환전! 이번 주사위 합+10점을 빈 하단 칸에 쓸 수 있어요. 최대 40점, 배율·족보 가산점 제외. 이후 재굴림 종료. 게임당 1회.",
    1,
    "sum",
  ],
  [
    "target",
    "목표 명중",
    "첫 굴림 전에 목표 칸을 골라요. 그 칸에 1점 이상 기록하면 +12점. 다른 칸에 쓰거나 0점을 쓰면 -6점. 매 턴 1회.",
    -1,
    "gamble",
  ],
  [
    "loan",
    "여기서 두 배를 태워?",
    "첫 굴림 전에 선언! 기본 족보 25점 이상이면 +20점, 미만이면 -10점. 두 번째 일반 굴림 뒤 두 배 걸고 한 번 더 던지면 +40/-20! 게임당 1회.",
    1,
    "gamble",
  ],
  [
    "revive",
    "패자 부활전",
    "지난 내 족보가 0점이었다면 첫 굴림 전에 사용해요. 주사위 하나를 원하는 눈으로 정해 보관하고, 나머지만 굴려요. 매 턴 1회.",
    -1,
    "zero",
  ],
  [
    "parasite",
    "기생충",
    "상대가 기본 족보 점수 25점 이상을 기록하면 나는 +5점. 한 라운드에 최대 +10점까지 받아요.",
    0,
    "rival",
  ],
  [
    "thief",
    "압류 예고장",
    "상대는 다음 턴 5점을 내거나 도전! 도전해서 기본 족보 25점 이상이면 내게 15점, 미만이면 내가 상대에게 8점. 소지 점수까지만, 피해 상한 15점 예외. 게임당 2회.",
    2,
    "attack",
  ],
  [
    "lock",
    "강제 고정",
    "상대의 다음 첫 굴림에서 무작위 주사위 하나를 묶어요. 상대는 그 턴이 끝날 때까지 그 주사위를 다시 굴릴 수 없어요. 게임당 2회.",
    2,
    "attack",
  ],
  [
    "seal",
    "굴림 봉인",
    "상대의 다음 턴 일반 굴림을 1회 줄여요. 그래도 최소 1회는 굴릴 수 있어요. 게임당 1회.",
    1,
    "attack",
  ],
  [
    "reflect",
    "반사 방패",
    "매 라운드 나에게 처음 들어오는 방해를 막고, 공격한 사람에게 -5점. 이 반격은 다시 반사되지 않아요.",
    0,
    "defense",
  ],
  [
    "loser",
    "꼴찌의 미학",
    "내 턴 시작에 1위보다 40점 이상 뒤처졌다면, 이번 일반 굴림이 1회 늘어나요.",
    0,
    "comeback",
  ],
  [
    "sixth",
    "여섯 번째 주사위",
    "매 턴 주사위를 1개 더 굴려요. 버리는 주사위 없이 전부 점수 계산에 써요.",
    0,
    "roll",
  ],
  [
    "wild",
    "무지개 와일드",
    "굴린 주사위 하나를 원하는 숫자(1~6)로 바꿔요. 사용 후에는 더 굴리거나 눈을 바꿀 수 없어요. 매 턴 1회.",
    -1,
    "change",
  ],
  [
    "defect",
    "불량품도 야추다",
    "같은 숫자 4개만 모아도 요트 칸에 40점! 같은 숫자가 5개 이상이면 원래대로 50점이에요.",
    0,
    "kind",
  ],
  [
    "cat",
    "상자 속 고양이",
    "일반 굴림을 다 쓴 뒤 사용해요. 첫 굴림 결과로 돌아가 남은 횟수만큼 다시 굴리고, 원래 결과와 새 결과 중 골라요. 게임당 1회.",
    1,
    "roll",
  ],
  [
    "erase",
    "지워진 0",
    "이번 점수를 쓰기 전에 예전에 0점을 쓴 칸을 골라요. 이번 주사위로 그 칸도 다시 채점해요. 0점 칸이 없으면 대신 +10점. 게임당 1회.",
    1,
    "zero",
  ],
  [
    "parallel",
    "한 턴에 두 탕",
    "기록할 칸 말고 다른 빈칸 하나를 골라요. 그 칸 점수를 전액 보너스로! 최대 40점, 보너스 칸은 남아요. 별도 보너스는 재발동하지 않아요. 게임당 1회.",
    1,
    "lower",
  ],
  [
    "devil",
    "악마의 계약",
    "첫 굴림 전에 선언하세요. 기본 족보 점수 25점 이상이면 그 칸의 점수를 2배로, 미만이면 0점으로 기록해요. 매 턴 선택 가능.",
    -1,
    "gamble",
  ],
  [
    "substitute",
    "족보 대체권",
    "족보가 안 맞아도 빈칸 하나에 주사위 합을 쓸 수 있어요. 최대 25점. 예: 요트 실패여도 합이 23이면 요트 칸에 23점. 매 턴 1회.",
    -1,
    "safe",
  ],
  [
    "worldFlip",
    "세상을 뒤집는 자",
    "뒤집을 주사위를 한 번에 골라요. 1↔6, 2↔5, 3↔4로 바뀌어요. 이후 재굴림은 끝나지만 다른 눈 변경 능력은 쓸 수 있어요. 매 턴 1회.",
    -1,
    "change",
  ],
  [
    "swap",
    "왕의 압수수색",
    "획득 즉시 내 골드 1개와 상대 골드 1개를 영구 교환해요. 다 쓴 능력은 못 바꿔요. 교환할 대상이 없으면 대신 +10점.",
    1,
    "attack",
  ],
  [
    "duel",
    "콜? 쫄?",
    "상대가 다음 턴에 10점 내고 거절하거나 수락! 수락하면 서로 다음 턴 최대 2번 굴려 기본 족보로 승부. 승자 +35, 패자 -10, 동점 각 +10점. 게임당 1회.",
    1,
    "attack",
  ],
  [
    "doppel",
    "도플갱어",
    "획득 즉시 상대의 횟수 제한 없는 골드 능력 1개를 복사해요. 상대 능력도 남아요. 복사할 대상이 없으면 대신 +10점.",
    1,
    "rival",
  ],
];
const passive = new Set(["shield", "sixth"]);
export const AUGMENTS: AugmentDefinition[] = rows.map(
  ([id, name, description, charges, tag], i) => ({
    id,
    name,
    description,
    charges,
    tags: [tag],
    rarity: i < 18 ? "silver" : i < 36 ? "gold" : "prism",
    trigger: charges === 0 || passive.has(id) ? "passive" : "active",
  }),
);
AUGMENTS.push({
  id: "evolution",
  name: "\uD604\uC2E4 \uC870\uC791",
  rarity: "gold",
  description:
    "손끝 보정을 이 능력으로 교체해요. 주사위 하나를 최대 2 올리거나 내려요. 예: 4 → 2·3·5·6. 1~6 안에서, 턴당 1회·새로 4회 사용 가능.",
  trigger: "active",
  charges: 4,
  tags: ["change"],
});
export const FLASH_AUGMENTS: AugmentDefinition[] = [
  {
    id: "taxSix",
    name: "6 나왔죠? 세금입니다",
    rarity: "silver",
    description:
      "상대의 다음 턴 마지막 주사위에 6이 하나 있을 때마다 그 턴 득점에서 -2점. 최대 -6점, 게임당 2회.",
    charges: 2,
    trigger: "active",
    tags: ["attack"],
    flash: true,
  },
  {
    id: "dropIt",
    name: "바나나 껍질",
    rarity: "silver",
    description:
      "상대의 다음 첫 굴림에서 가장 높은 주사위 하나가 미끄러져 1로 바뀌어요. 같은 눈이면 무작위 하나! 이후 다시 굴릴 수 있어요. 게임당 1회.",
    charges: 1,
    trigger: "active",
    tags: ["attack"],
    flash: true,
  },
  {
    id: "receipt",
    name: "망한 건 영수증 주세요",
    rarity: "silver",
    description:
      "상대를 찍어두세요. 그 사람이 다음 족보를 0점으로 기록하면 나는 +6점. 1점 이상 기록하면 오히려 상대가 +2점! 게임당 2회.",
    charges: 2,
    trigger: "active",
    tags: ["gamble"],
    flash: true,
  },
  {
    id: "broken",
    name: "고장입니다 고객님",
    rarity: "gold",
    description:
      "상대가 버튼을 눌러 쓰는 골드 능력 하나를 골라요. 상대는 다음 턴 동안 그 능력을 못 써요. 남은 횟수는 그대로예요. 게임당 2회.",
    charges: 2,
    trigger: "active",
    tags: ["attack"],
    flash: true,
  },
  {
    id: "construction",
    name: "거기는 공사 중",
    rarity: "gold",
    description:
      "상대의 빈 점수칸 하나를 막아요. 상대는 다음 턴에 그 칸을 고를 수 없어요. 다른 빈칸이 남아 있어야 해요. 게임당 2회.",
    charges: 2,
    trigger: "active",
    tags: ["attack"],
    flash: true,
  },
  {
    id: "handsUp",
    name: "전원 믹서기 입장",
    rarity: "gold",
    description:
      "나를 포함해 다음 두 번째 일반 굴림에 보관한 주사위도 전부 컵으로! 강제 보관은 제외. 실제로 섞은 뒤 마지막 합이 25 이상이면 +10점. 첫 굴림에 기록하면 회피! 게임당 1회.",
    charges: 1,
    trigger: "active",
    tags: ["attack"],
    flash: true,
  },
  {
    id: "closed",
    name: "오늘 장사 접으세요",
    rarity: "prism",
    description:
      "상대의 빈 점수칸 2개를 다음 턴 동안 막아요. 한 명에게 몰아도, 두 명에게 나눠도 돼요. 각자 다른 빈칸은 남아야 해요. 게임당 1회.",
    charges: 1,
    trigger: "active",
    tags: ["attack"],
    flash: true,
  },
  {
    id: "strike",
    name: "점수표 회전목마",
    rarity: "prism",
    description:
      "하단 칸 하나를 골라요. 그 칸을 쓴 사람들끼리 점수를 무작위 방향으로 한 자리 회전! 나도 포함, 방패는 제외. 이미 점수 교환당한 사람 제외, 게임당 1회.",
    charges: 1,
    trigger: "active",
    tags: ["attack"],
    flash: true,
  },
  {
    id: "squid",
    name: "판돈은 목숨입니다",
    rarity: "prism",
    description:
      "참가자 전원 20점 납부! 다음 턴 최대 2번 굴려 기본 족보 최고점이 판돈 전액+40점을 받아요. 동점은 나눠 갖기. 나 포함 2명 이상·소지 20점 필요. 방패로 거절, 기권 시 환급. 게임당 1회.",
    charges: 1,
    trigger: "active",
    tags: ["gamble"],
    flash: true,
  },
];
AUGMENTS.push(...FLASH_AUGMENTS);
export const MISCHIEF_IDS = [
  "parkingTicket",
  "butterFingers",
  "ordinaryDay",
  "bounty",
  "inspection",
];
AUGMENTS.push(
  {
    id: "parkingTicket",
    name: "거기 주차 금지",
    rarity: "silver",
    trigger: "active",
    charges: 2,
    tags: ["attack"],
    description:
      "상대가 다음 턴에 한 번이라도 주사위를 3개 이상 보관하면, 그 턴 득점에서 -4점. 2개까지만 보관하면 피할 수 있어요. 게임당 2회.",
  },
  {
    id: "butterFingers",
    name: "손에 버터 발랐냐",
    rarity: "gold",
    trigger: "active",
    charges: 1,
    tags: ["attack"],
    description:
      "상대는 다음 턴에 주사위를 1개까지만 보관할 수 있어요. 나머지는 다시 굴릴 때 전부 컵으로! 게임당 1회.",
  },
  {
    id: "ordinaryDay",
    name: "오늘부터 일반인",
    rarity: "prism",
    trigger: "active",
    charges: 1,
    tags: ["attack"],
    description:
      "상대는 다음 턴에 버튼을 눌러 쓰는 증강을 전부 못 써요. 자동 효과와 사건 능력은 쓸 수 있고, 남은 사용 횟수도 줄지 않아요. 게임당 1회.",
  },
);
AUGMENTS.push({
  id: "tomorrow",
  name: "흑역사 세탁",
  rarity: "silver",
  trigger: "active",
  charges: 2,
  tags: ["hold"],
  description:
    "1~3인 주사위 하나를 찍으면 다음 내 첫 굴림에 반대 눈(6~4)을 보관하고 시작해요. 이번 주사위는 그대로, 계속 굴려도 돼요. 턴당 1회·게임당 2회.",
});
export const NEW_AUGMENTS: AugmentDefinition[] = [
  {
    id: "bounty",
    name: "숫자 공개수배",
    rarity: "silver",
    charges: 2,
    trigger: "active",
    tags: ["attack"],
    description:
      "상대와 숫자 하나를 찍어요. 상대의 다음 턴 마지막 주사위에 그 숫자가 3개 이상이면 나는 +6점. 상대 점수는 그대로예요. 게임당 2회.",
  },
  {
    id: "taste",
    name: "남의 떡 한입만",
    rarity: "gold",
    charges: 2,
    trigger: "active",
    tags: ["change"],
    description:
      "첫 굴림 직후, 다른 눈 변경을 하기 전에 써요. 상대의 지난 최종 결과에 있던 숫자를 내 주사위 하나에 복사해요. 턴당 1회·게임당 2회.",
  },
  {
    id: "inspection",
    name: "품질검사 들어갑니다",
    rarity: "gold",
    charges: 2,
    trigger: "active",
    tags: ["attack"],
    description:
      "상대는 다음 첫 굴림 뒤 둘 중 하나를 골라야 해요: 가장 작은 주사위를 끝까지 보관하거나, 전부 무료로 다시 굴리기. 게임당 2회.",
  },
  {
    id: "memory",
    name: "선택적 기억",
    rarity: "prism",
    charges: 1,
    trigger: "active",
    tags: ["hold"],
    description:
      "첫 굴림 전에 써요. 지난 내 결과를 앞에서부터 최대 5개 가져와 첫 굴림으로 써요. 남는 주사위만 새로 굴려요. 미리 보관한 주사위가 없어야 해요. 게임당 1회.",
  },
  {
    id: "fork",
    name: "평행 던지기",
    rarity: "prism",
    charges: 2,
    trigger: "active",
    tags: ["roll"],
    description:
      "다음 일반 굴림을 두 번 던져 A 또는 B 결과 전체를 골라요. 횟수는 1회만 차감! 첫 굴림에 걸린 방해는 먼저 해결해야 해요. 턴당 1회·게임당 2회.",
  },
  {
    id: "dinner",
    name: "오늘 회식은 1차만",
    rarity: "silver",
    charges: 1,
    trigger: "active",
    tags: ["gamble"],
    flash: true,
    description:
      "전원 강제 회식! 각자 다음 턴에 1 하나당 +2점(최대 +6점), 1이 없으면 회식비 -4점. 나도 적용! 나는 개최비 +3점을 즉시 받아요. 방패로 거절 가능, 게임당 1회.",
  },
  {
    id: "bombParcel",
    name: "착불 폭탄입니다",
    rarity: "gold",
    charges: 1,
    trigger: "active",
    tags: ["attack"],
    flash: true,
    description:
      "상대는 다음 턴 내게 10점을 내거나 폭탄을 열어요. 1~3이면 상대가 내게 20점, 4~6이면 역폭발! 내가 상대에게 15점. 가진 점수까지만 이동, 피해 상한 20점 예외. 게임당 1회.",
  },
  {
    id: "hostage",
    name: "주사위 인질극",
    rarity: "prism",
    charges: 1,
    trigger: "active",
    tags: ["attack"],
    flash: true,
    description:
      "내 주사위 둘의 눈을 보내고 이번 굴림을 끝내요. 상대는 다음 첫 굴림 뒤 내게 8점을 주거나, 자기 주사위 둘을 보낸 눈으로 바꿔 끝까지 보관해야 해요. 게임당 1회.",
  },
];
AUGMENTS.push(...NEW_AUGMENTS);
AUGMENTS.push({
  id: "confiscate",
  name: "전부 압수입니다",
  rarity: "prism",
  trigger: "active",
  charges: 1,
  tags: ["attack"],
  flash: true,
  description:
    "상대마다 다음 턴 주사위를 1개씩 뺏어요. 나는 다음 내 턴에 실제로 뺏은 만큼 더 굴려요. 방패로 막힌 주사위는 못 가져와요. 게임당 1회.",
});
const chaosReworks: Record<
  string,
  { name: string; description: string; charges?: number }
> = {
  inspection: {
    name: "보관함 털이",
    description:
      "상대의 다음 두 번째 일반 굴림에 보관한 주사위 최대 2개도 컵에 넣어요. 강제 보관은 제외! 첫 굴림만으로 기록하면 피해요. 게임당 2회.",
  },
  memory: {
    name: "명장면 재방송",
    description:
      "첫 굴림 전에 내가 예전에 기록했던 결과 하나를 골라 재현해요. 앞에서 최대 5개를 가져오고 남는 주사위만 새로 굴려요. 미리 보관한 주사위가 없어야 해요. 게임당 2회.",
    charges: 2,
  },
  receipt: {
    name: "그거 굴리면 터진다",
    description:
      "상대의 다음 첫 굴림에 폭탄 주사위 하나! 다시 굴리면 나는 +3점, 안 굴리고 기록하면 상대 득점 -4점. 게임당 2회.",
  },
  broken: {
    name: "그 버튼 이제 제 겁니다",
    description:
      "상대의 사용형 골드 하나를 다음 턴 동안 막고 내가 한 번 빌려 써요. 빌린 능력은 내 다음 턴 끝에 사라져요. 상대의 사용 횟수는 그대로! 게임당 1회.",
    charges: 1,
  },
  construction: {
    name: "메뉴판이 살아 있다",
    description:
      "상대는 다음 턴에 무작위 빈칸 3개만 기록할 수 있어요. 일반 굴림이 끝날 때마다 메뉴를 다시 추첨! 무료 재굴림은 메뉴 유지. 빈칸 4개 이상인 상대에게 게임당 1회.",
    charges: 1,
  },
  closed: {
    name: "성적표 맞바꿔치기",
    description:
      "나와 상대가 이미 쓴 같은 하단 점수칸 하나를 통째로 맞바꿔요. 예: 내 요트 0점 ↔ 상대 50점! 상대는 게임 중 한 번만 당해요. 게임당 1회.",
  },
  hostage: {
    name: "악마의 택배",
    description:
      "상대는 다음 첫 굴림 뒤 내게 몸값 30점을 주거나, 주사위 세 개를 1로 봉인! 봉인된 셋은 그 턴 재굴림·눈 변경 불가. 몸값은 피해 상한 30점 예외, 방패로 방어 가능. 게임당 1회.",
  },
};
for (const d of AUGMENTS)
  if (chaosReworks[d.id]) Object.assign(d, chaosReworks[d.id]);
const chaosNew: AugmentDefinition[] = [
  {
    id: "practice",
    name: "방금 건 연습",
    rarity: "silver",
    charges: 1,
    trigger: "active",
    flash: true,
    tags: ["attack"],
    description:
      "상대의 다음 첫 굴림에서 가장 높은 주사위 하나를 자동으로 다시 던져요. 새 결과 필수, 일반 굴림 횟수는 그대로! 게임당 1회.",
  },
  {
    id: "misdelivery",
    name: "택배 오배송",
    rarity: "gold",
    charges: 1,
    trigger: "active",
    flash: true,
    tags: ["attack", "change"],
    description:
      "내 주사위 하나를 상대의 지난 결과에 있던 눈으로 바꿔요. 상대는 다음 첫 굴림에 내 원래 눈을 보관하고 시작해요. 이후 보관 해제 가능! 게임당 1회.",
  },
  {
    id: "goldRush",
    name: "골드 대이동",
    rarity: "prism",
    charges: 1,
    trigger: "active",
    flash: true,
    tags: ["attack"],
    description:
      "나를 포함해 각자의 골드 하나씩을 무작위로 뽑아 다음 좌석에게 영구 전달해요. 남은 사용 횟수도 그대로! 방패로 막힌 사람은 제외, 게임당 1회.",
  },
];
AUGMENTS.push(...chaosNew);
export const EVENTS = [
  {
    id: "reverse",
    name: "거꾸로 세계",
    description:
      "이번 턴에 한 번, 주사위 하나를 뒤집을 수 있어요. 1↔6, 2↔5, 3↔4. 사용 후 재굴림은 끝나요.",
  },
  {
    id: "speed",
    name: "속전속결",
    description:
      "이번 라운드는 모두 일반 굴림이 1회 줄어요. 대신 족보에 1점 이상 기록하면 보너스 +10점.",
  },
  {
    id: "overflow",
    name: "주사위 과잉 공급",
    description:
      "이번 라운드는 모두 주사위를 1개 더 굴려요. 버리지 않고 나온 주사위 전부로 점수를 계산해요.",
  },
  {
    id: "aid",
    name: "정부 지원금",
    description:
      "이번 기본 족보 점수가 0점이면 보너스 +12점, 1~15점이면 +6점. 16점 이상은 지원금이 없어요.",
  },
  {
    id: "bomb",
    name: "폭탄 돌리기",
    description:
      "첫 굴림 전에 도전할지 골라요. 마지막 주사위에 6이 3개 이상이면 +20점, 아니면 -8점. 도전하지 않아도 돼요.",
  },
  {
    id: "chaos",
    name: "혼돈의 선택",
    description:
      "한 번만 주사위 하나를 무료로 다시 굴릴 수 있어요. 새 결과를 반드시 쓰고, 그 뒤에는 더 굴릴 수 없어요.",
  },
  {
    id: "debt",
    name: "빚내서 굴려",
    description:
      "첫 굴림 전에 선택하세요. 이번 턴 점수에서 8점을 내는 대신 일반 굴림이 1회 늘어나요. 선택하지 않아도 돼요.",
  },
  {
    id: "exchange",
    name: "숫자 교환소",
    description:
      "두 번째 일반 굴림 이후, 주사위 하나를 무료로 다시 굴리면 보너스 +8점. 새 결과를 반드시 써야 해요. 이번 턴 1회.",
  },
] as const;
export const augmentCommandSchema = z.strictObject({
  op: z.enum(["pick", "refresh", "use", "keepOld", "world", "resolve"]),
  id: z.string().max(40).optional(),
  offerIndex: z.number().int().min(0).max(2).optional(),
  die: z.number().int().min(0).max(9).optional(),
  historyIndex: z.number().int().min(0).max(11).optional(),
  value: z.number().int().min(0).max(9).optional(),
  target: z.string().max(40).optional(),
  other: z.string().max(40).optional(),
  category: z.string().max(30).optional(),
  indices: z.array(z.number().int().min(0).max(9)).max(10).optional(),
  seals: z
    .array(
      z.object({ target: z.string().max(40), category: z.string().max(30) }),
    )
    .max(2)
    .optional(),
});
export type AugmentCommand = z.infer<typeof augmentCommandSchema>;
const instance = z.object({
  id: z.string(),
  remaining: z.number().int(),
  usedTurn: z.number().int().default(-1),
  usedRound: z.number().int().default(-1),
  borrowedAt: z.number().int().optional(),
});
export const augmentPlayerSchema = z.object({
  items: z.array(instance),
  offers: z.array(z.string()),
  rerolled: z.array(z.boolean()).length(3).default([false, false, false]),
  seenOffers: z.array(z.string()).max(6).default([]),
  flashOffer: z.boolean().default(false),
  bonus: z.number(),
  rawUpper: z.number(),
  streak: z.number(),
  savingsPaid: z.boolean(),
  previousZero: z.boolean(),
  savedFace: z.number().int().min(1).max(6).nullable().optional(),
  lastDice: z.array(z.number().int().min(1).max(6)).optional(),
  archive: z
    .array(
      z.object({
        category: z.string(),
        dice: z.array(z.number().int().min(1).max(6)).max(10),
      }),
    )
    .max(12)
    .default([]),
  scoreSwapped: z.boolean().default(false),
  roundIncome: z.record(z.string(), z.number()),
  curse: z
    .object({
      id: z.string(),
      from: z.string(),
      active: z.boolean().optional(),
      die: z.number().int().min(0).max(9).optional(),
      resolved: z.boolean().optional(),
      other: z.string().optional(),
      values: z.array(z.number().int().min(1).max(6)).max(3).optional(),
      categories: z.array(z.string()).optional(),
    })
    .nullable(),
});
const snapshot = z.object({
  dice: z.array(z.number().nullable()),
  held: z.array(z.boolean()),
  rolls: z.number(),
  kept: z.array(z.number()).optional(),
  poses: z
    .array(
      z.object({
        p: z.tuple([z.number(), z.number(), z.number()]),
        q: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    )
    .optional(),
});
export const augmentStateSchema = z.object({
  round: z.number().int(),
  drafting: z.boolean(),
  order: z.array(z.string()),
  done: z.array(z.string()),
  first: z.number().int(),
  event: z.string().nullable(),
  log: z.array(z.string()),
  results: z.array(z.object({ key: z.string(), text: z.string(), payouts: z.array(z.object({playerId:z.string(),amount:z.number(),reason:z.string()})).optional(), activation: z.object({
    id: z.string(), actor: z.string(), targets: z.array(z.string()), name: z.string(), effect: z.string(),
    kind: z.enum(["attack", "defense", "dice", "swap", "gamble", "score"]),
    rarity: z.enum(["silver", "gold", "prism"]), flash: z.boolean(),
  }).optional() })).default([]),
  turn: z.object({
    pending: z
      .enum(["bombParcel", "hostage", "forkSecond", "forkChoice", "thief", "duel"])
      .optional(),
    fork: z.object({ start: snapshot, first: snapshot.optional() }).optional(),
    saveIndex: z.number().int().optional(),
    hostage: z
      .object({ target: z.string(), indices: z.array(z.number().int()) })
      .optional(),
    fixed: z.array(z.number().int()).optional(),
    sealed: z.array(z.number().int()).optional(),
    preheld: z.array(z.number().int()).optional(),
    serial: z.number().int(),
    maxRolls: z.number().int(),
    gap: z.number(),
    locked: z.number().int().nullable(),
    kept: z.array(z.number()),
    flags: z.array(z.string()),
    target: z.string().nullable(),
    extra: z.number(),
    first: snapshot.nullable(),
    oldWorld: snapshot.nullable(),
    reroll: z
      .object({
        id: z.string(),
        index: z.number().int(),
        old: z.number(),
        held: z.array(z.boolean()),
      })
      .nullable(),
    chooseOld: z
      .object({ index: z.number().int(), old: z.number() })
      .nullable(),
    erase: z.string().nullable(),
    parallel: z.string().nullable(),
  }),
  duels: z.array(
    z.object({
      a: z.string(),
      b: z.string(),
      aScore: z.number().nullable(),
      bScore: z.number().nullable(),
      after: z.number(),
      accepted: z.boolean().default(false),
    }),
  ),
  jackpot: z.object({after: z.number(), entries: z.array(z.object({id: z.string(), score: z.number().nullable()})), pot: z.number()}).optional(),
});
export type AugmentState = z.infer<typeof augmentStateSchema>;
export type AugmentPlayer = z.infer<typeof augmentPlayerSchema>;
export type AugmentInstance = AugmentPlayer["items"][number];
export const newAugmentPlayer = (): AugmentPlayer => ({
  items: [],
  offers: [],
  rerolled: [false, false, false],
  seenOffers: [],
  flashOffer: false,
  bonus: 0,
  rawUpper: 0,
  streak: 0,
  savingsPaid: false,
  previousZero: false,
  archive: [],
  scoreSwapped: false,
  roundIncome: {},
  curse: null,
});
